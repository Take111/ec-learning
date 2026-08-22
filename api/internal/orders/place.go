// Package orders は注文作成のトランザクションを担う。
// 「全部成功か全部失敗か」(業務ルール由来)の境界線はこの層が引く。
// sqlc生成コード(internal/db)は型を提供するだけで、Begin/Commit はここの責務。
package orders

import (
	"context"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	"ec-learning/api/internal/db"
)

// 送料ルール: 小計5,000円以上は無料、未満は550円(データ生成 tools/seed と同一ルール)
const (
	freeShippingLine = 5000
	shippingFeeJpy   = 550
)

type Item struct {
	ProductID int64
	Quantity  int32
}

type Input struct {
	IdempotencyKey pgtype.UUID
	UserID         int64
	AddressID      int64
	Items          []Item
	// クライアントが画面表示していた合計。nil なら検証しない。
	// 金額はサーバーが決める原則のため、これは価格改定の「検知」専用(不一致は409)
	ExpectedTotalJpy *int32
}

type Result struct {
	OrderID        int64
	Status         string
	TotalJpy       int32
	ShippingFeeJpy int32
	// 冪等キーにより既存注文を返した場合 true(HTTP層は201ではなく200を返す)
	Replayed bool
}

var ErrInvalidAddress = errors.New("address not found for user")

type InsufficientStockError struct{ ProductID int64 }

func (e *InsufficientStockError) Error() string {
	return fmt.Sprintf("insufficient stock: product %d", e.ProductID)
}

type PriceMismatchError struct{ Expected, Actual int32 }

func (e *PriceMismatchError) Error() string {
	return fmt.Sprintf("price mismatch: expected %d, actual %d", e.Expected, e.Actual)
}

func Place(ctx context.Context, pool *pgxpool.Pool, in Input) (Result, error) {
	tx, err := pool.Begin(ctx)
	if err != nil {
		return Result{}, err
	}
	// Commit 済みなら Rollback は no-op。エラーパスでの戻し忘れを仕組みで防ぐ定石
	// Commit 成功後の Rollback は ErrTxClosed を返すだけ(pgx の定石として意図的に無視)
	defer func() { _ = tx.Rollback(ctx) }()

	q := db.New(tx)

	// 1. 冪等キー付き仮INSERT(total=0)。
	//    在庫UPDATEより「前」にあることが重要: リトライは在庫を触る前にここで検出される
	created, err := q.CreateOrder(ctx, db.CreateOrderParams{
		IdempotencyKey: in.IdempotencyKey,
		UserID:         in.UserID,
		AddressID:      in.AddressID,
	})
	if errors.Is(err, pgx.ErrNoRows) {
		// 0行は「キー衝突」か「住所不正」の2択。既存注文の有無で見分ける
		existing, err2 := q.GetOrderByIdempotencyKey(ctx, in.IdempotencyKey)
		if errors.Is(err2, pgx.ErrNoRows) {
			return Result{}, ErrInvalidAddress
		}
		if err2 != nil {
			return Result{}, err2
		}
		return Result{OrderID: existing.ID, Status: existing.Status,
			TotalJpy: existing.TotalJpy, ShippingFeeJpy: existing.ShippingFeeJpy,
			Replayed: true}, nil
	}
	if err != nil {
		return Result{}, err
	}

	// 2. 明細ごとに在庫引き当て(アトミック)+ スナップショット価格で明細登録
	var subtotal int32
	for _, it := range in.Items {
		price, err := q.DecrementStock(ctx, db.DecrementStockParams{
			ProductID: it.ProductID,
			Quantity:  it.Quantity,
		})
		if errors.Is(err, pgx.ErrNoRows) {
			// 0行 = 在庫不足 or 非アクティブ。トランザクションごと失敗させる
			return Result{}, &InsufficientStockError{ProductID: it.ProductID}
		}
		if err != nil {
			return Result{}, err
		}
		if err := q.InsertOrderItem(ctx, db.InsertOrderItemParams{
			OrderID:      created.ID,
			ProductID:    it.ProductID,
			Quantity:     it.Quantity,
			UnitPriceJpy: price, // DecrementStock が返した「その時点の価格」。products は再読みしない
		}); err != nil {
			return Result{}, err
		}
		subtotal += price * it.Quantity
	}

	// 3. 金額はサーバーが決定する
	fee := int32(shippingFeeJpy)
	if subtotal >= freeShippingLine {
		fee = 0
	}
	total := subtotal + fee

	if in.ExpectedTotalJpy != nil && *in.ExpectedTotalJpy != total {
		return Result{}, &PriceMismatchError{Expected: *in.ExpectedTotalJpy, Actual: total}
	}

	// 4. 確定UPDATE(同一Tx内なのでコミットまで外からは見えない)
	if err := q.FinalizeOrder(ctx, db.FinalizeOrderParams{
		ID: created.ID, TotalJpy: total, ShippingFeeJpy: fee,
	}); err != nil {
		return Result{}, err
	}

	if err := tx.Commit(ctx); err != nil {
		return Result{}, err
	}
	// Status は CreateOrder の RETURNING 由来(DBが唯一の情報源。Goに'pending'を二重定義しない)
	return Result{OrderID: created.ID, Status: created.Status, TotalJpy: total, ShippingFeeJpy: fee}, nil
}
