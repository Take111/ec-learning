// api のエントリポイント。起動と配線だけを書き、ロジックは internal/ に置く。
package main

import (
	"cmp"
	"context"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"ec-learning/api/internal/handler"
)

func main() {
	ctx := context.Background()

	// 接続文字列は空でよい: pgx は PGHOST/PGUSER 等の環境変数を読む(libpq互換)。
	// ローカルでは mise.toml の [env] がそれを供給する
	pool, err := pgxpool.New(ctx, "")
	if err != nil {
		log.Fatalf("db pool: %v", err)
	}
	// pool.Close() は書かない: この main は log.Fatal で終わるため defer は実行されず、
	// 接続はプロセス終了で閉じる。graceful shutdown が必要になったら(フェーズD)ここを見直す
	if err := pool.Ping(ctx); err != nil {
		log.Fatalf("db ping: %v", err)
	}

	ordersHandler := &handler.Orders{Pool: pool}
	productsHandler := &handler.Products{Pool: pool}
	categoriesHandler := &handler.Categories{Pool: pool}

	mux := http.NewServeMux()
	// Go 1.22+ の ServeMux は「メソッド パス」形式でルートを書ける(外部ルーター不要の根拠)
	mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("ok"))
	})
	mux.HandleFunc("POST /orders", ordersHandler.Place)
	mux.HandleFunc("GET /orders", ordersHandler.ListByUser)
	mux.HandleFunc("GET /products", productsHandler.List)
	mux.HandleFunc("GET /products/{id}", productsHandler.Detail)
	mux.HandleFunc("GET /categories", categoriesHandler.List)

	// タイムアウトを明示(ゼロ値=無制限は Slowloris 型のコネクション占有を許す)。
	// :8080 の全インターフェース待受は実機 Expo からの LAN 接続用に意図的
	addr := cmp.Or(os.Getenv("API_ADDR"), ":8080")
	srv := &http.Server{
		Addr:              addr,
		Handler:           mux,
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       10 * time.Second,
		WriteTimeout:      20 * time.Second,
		IdleTimeout:       60 * time.Second,
	}
	log.Printf("listening on %s", addr)
	log.Fatal(srv.ListenAndServe())
}
