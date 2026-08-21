// 並行テスト: 「仕組みで安全」を実DBへの同時攻撃で証明する(B-4)。
//
// 前提: ローカルの PostgreSQL(mise の [env] が PG* を供給)に接続する統合テスト。
//
//	テストデータは自前で作成し、終了時に削除する(シードデータは汚さない)。
package orders_test

import (
	"context"
	"errors"
	"fmt"
	"sync"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	"ec-learning/api/internal/orders"
)

func newPool(t *testing.T) *pgxpool.Pool {
	t.Helper()
	pool, err := pgxpool.New(context.Background(), "")
	if err != nil {
		t.Fatalf("pool: %v", err)
	}
	if err := pool.Ping(context.Background()); err != nil {
		t.Fatalf("DBに接続できない(mise run up 済みか?): %v", err)
	}
	t.Cleanup(pool.Close)
	return pool
}

type fixtures struct {
	userID, addressID, productID int64
}

// テスト用の user / address / product(在庫stock個)を作る。t.Cleanup で削除
func createFixtures(t *testing.T, pool *pgxpool.Pool, stock int32) fixtures {
	t.Helper()
	ctx := context.Background()
	var f fixtures
	email := fmt.Sprintf("test+%d@example.com", time.Now().UnixNano())
	if err := pool.QueryRow(ctx,
		`INSERT INTO users (email, name, prefecture) VALUES ($1, 'テスト太郎', '東京都') RETURNING id`,
		email).Scan(&f.userID); err != nil {
		t.Fatalf("user: %v", err)
	}
	if err := pool.QueryRow(ctx,
		`INSERT INTO user_addresses (user_id, label, postal_code, prefecture, line1)
		 VALUES ($1, '自宅', '100-0001', '東京都', 'テスト1-1') RETURNING id`,
		f.userID).Scan(&f.addressID); err != nil {
		t.Fatalf("address: %v", err)
	}
	if err := pool.QueryRow(ctx,
		`INSERT INTO products (category_id, name, price_jpy, stock, is_active)
		 VALUES ((SELECT min(id) FROM categories WHERE parent_id IS NOT NULL), 'テスト商品', 1000, $1, true)
		 RETURNING id`,
		stock).Scan(&f.productID); err != nil {
		t.Fatalf("product: %v", err)
	}
	t.Cleanup(func() {
		// FK依存の逆順で削除
		_, _ = pool.Exec(ctx, `DELETE FROM order_items WHERE order_id IN (SELECT id FROM orders WHERE user_id = $1)`, f.userID)
		_, _ = pool.Exec(ctx, `DELETE FROM orders WHERE user_id = $1`, f.userID)
		_, _ = pool.Exec(ctx, `DELETE FROM products WHERE id = $1`, f.productID)
		_, _ = pool.Exec(ctx, `DELETE FROM user_addresses WHERE id = $1`, f.addressID)
		_, _ = pool.Exec(ctx, `DELETE FROM users WHERE id = $1`, f.userID)
	})
	return f
}

func testUUID(t *testing.T, n int64) pgtype.UUID {
	t.Helper()
	var u pgtype.UUID
	// 実行ごとに異なる時刻部 + 連番でユニークにする(衝突すると冪等リプレイ扱いになり誤判定するため)
	s := fmt.Sprintf("%08x-0000-4000-8000-%012x", time.Now().Unix(), n)
	if err := u.Scan(s); err != nil {
		t.Fatalf("uuid: %v", err)
	}
	return u
}

// 在庫5個に20本が同時注文 → 成功はちょうど5、在庫は0で止まる(マイナスにならない)
func TestConcurrentOrders_NoNegativeStock(t *testing.T) {
	pool := newPool(t)
	const stock, workers = 5, 20
	f := createFixtures(t, pool, stock)

	var wg sync.WaitGroup
	results := make(chan error, workers)
	for i := 0; i < workers; i++ {
		wg.Add(1)
		go func(n int64) {
			defer wg.Done()
			_, err := orders.Place(context.Background(), pool, orders.Input{
				IdempotencyKey: testUUID(t, 1000+n), // 全員バラバラのキー
				UserID:         f.userID,
				AddressID:      f.addressID,
				Items:          []orders.Item{{ProductID: f.productID, Quantity: 1}},
			})
			results <- err
		}(int64(i))
	}
	wg.Wait()
	close(results)

	var ok, stockErr, other int
	for err := range results {
		var stockE *orders.InsufficientStockError
		switch {
		case err == nil:
			ok++
		case errors.As(err, &stockE):
			stockErr++
		default:
			other++
			t.Errorf("想定外のエラー: %v", err)
		}
	}
	if ok != stock || stockErr != workers-stock || other != 0 {
		t.Errorf("成功=%d(期待%d) 在庫不足=%d(期待%d) その他=%d", ok, stock, stockErr, workers-stock, other)
	}

	var finalStock int32
	if err := pool.QueryRow(context.Background(), `SELECT stock FROM products WHERE id = $1`, f.productID).Scan(&finalStock); err != nil {
		t.Fatalf("stock: %v", err)
	}
	if finalStock != 0 {
		t.Errorf("最終在庫=%d(期待0。負なら行ロックが破れている)", finalStock)
	}

	var itemRows int
	if err := pool.QueryRow(context.Background(),
		`SELECT count(*) FROM order_items oi JOIN orders o ON o.id = oi.order_id WHERE o.user_id = $1`,
		f.userID).Scan(&itemRows); err != nil {
		t.Fatalf("items: %v", err)
	}
	if itemRows != stock {
		t.Errorf("明細行数=%d(期待%d。多ければロールバック漏れ)", itemRows, stock)
	}
}

// 同一の冪等キーで10本同時 → 実注文は1件、他は同じIDのリプレイ、在庫は1回だけ減る
func TestConcurrentSameIdempotencyKey(t *testing.T) {
	pool := newPool(t)
	const stock, workers = 5, 10
	f := createFixtures(t, pool, stock)
	key := testUUID(t, 999999)

	var wg sync.WaitGroup
	type outcome struct {
		res orders.Result
		err error
	}
	results := make(chan outcome, workers)
	for i := 0; i < workers; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			res, err := orders.Place(context.Background(), pool, orders.Input{
				IdempotencyKey: key, // 全員同じキー
				UserID:         f.userID,
				AddressID:      f.addressID,
				Items:          []orders.Item{{ProductID: f.productID, Quantity: 1}},
			})
			results <- outcome{res, err}
		}()
	}
	wg.Wait()
	close(results)

	var created, replayed int
	ids := map[int64]bool{}
	for o := range results {
		if o.err != nil {
			t.Fatalf("エラーは想定外: %v", o.err)
		}
		ids[o.res.OrderID] = true
		if o.res.Replayed {
			replayed++
		} else {
			created++
		}
	}
	if created != 1 || replayed != workers-1 {
		t.Errorf("新規=%d(期待1) リプレイ=%d(期待%d)", created, replayed, workers-1)
	}
	if len(ids) != 1 {
		t.Errorf("注文IDが%d種類(期待1。全員同じ注文を見るべき)", len(ids))
	}

	var finalStock int32
	if err := pool.QueryRow(context.Background(), `SELECT stock FROM products WHERE id = $1`, f.productID).Scan(&finalStock); err != nil {
		t.Fatalf("stock: %v", err)
	}
	if finalStock != stock-1 {
		t.Errorf("最終在庫=%d(期待%d。在庫が二重に引かれた疑い)", finalStock, stock-1)
	}
}
