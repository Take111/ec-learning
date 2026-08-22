// Package handler はHTTPの境界を担う: パース・バリデーション・エラー→ステータス変換。
// ビジネスロジック(トランザクション)は internal/orders に置き、この層には持ち込まない。
// 層深度のルール: 読み取り専用・単一クエリのエンドポイントは handler から db を直接呼ぶ。
// トランザクションや複数クエリの調整が生まれた時点で domain 層(internal/orders 等)に昇格する。
package handler

import (
	"encoding/json"
	"errors"
	"log"
	"net/http"

	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	"ec-learning/api/internal/orders"
)

type Orders struct {
	Pool *pgxpool.Pool
}

type placeOrderRequest struct {
	// 前提: 認証は未実装のため user_id をボディで受ける(フェーズBのスコープ外)。
	// 認証導入時はトークン由来に差し替え、ボディの user_id は廃止すること
	UserID    int64 `json:"user_id"`
	AddressID int64 `json:"address_id"`
	Items     []struct {
		ProductID int64 `json:"product_id"`
		Quantity  int32 `json:"quantity"`
	} `json:"items"`
	ExpectedTotalJpy *int32 `json:"expected_total_jpy"`
}

func (h *Orders) Place(w http.ResponseWriter, r *http.Request) {
	// 冪等キーはヘッダで受ける(リトライはボディ不変・キー同一が前提)
	var key pgtype.UUID
	if err := key.Scan(r.Header.Get("Idempotency-Key")); err != nil {
		writeError(w, http.StatusBadRequest, "missing_or_invalid_idempotency_key", nil)
		return
	}

	// 1MB あれば items 100件は余裕。巨大ボディの読み込ませ攻撃をここで遮断
	r.Body = http.MaxBytesReader(w, r.Body, 1<<20)
	var req placeOrderRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_json", nil)
		return
	}
	if req.UserID <= 0 || req.AddressID <= 0 || len(req.Items) == 0 {
		writeError(w, http.StatusBadRequest, "missing_required_fields", nil)
		return
	}
	// 上限は業務由来(1注文100明細・各999個)。無制限だと1リクエストで
	// トランザクション内クエリを大量発行され、行ロックの長期保持を許してしまう
	if len(req.Items) > 100 {
		writeError(w, http.StatusBadRequest, "too_many_items", nil)
		return
	}
	items := make([]orders.Item, 0, len(req.Items))
	seen := make(map[int64]bool, len(req.Items))
	for _, it := range req.Items {
		if it.ProductID <= 0 || it.Quantity <= 0 || it.Quantity > 999 {
			writeError(w, http.StatusBadRequest, "invalid_item", nil)
			return
		}
		// 同一商品の重複行は受けない(カート側でマージされる前提。明細の一意性をここで守る)
		if seen[it.ProductID] {
			writeError(w, http.StatusBadRequest, "duplicate_product", map[string]any{"product_id": it.ProductID})
			return
		}
		seen[it.ProductID] = true
		items = append(items, orders.Item{ProductID: it.ProductID, Quantity: it.Quantity})
	}

	result, err := orders.Place(r.Context(), h.Pool, orders.Input{
		IdempotencyKey:   key,
		UserID:           req.UserID,
		AddressID:        req.AddressID,
		Items:            items,
		ExpectedTotalJpy: req.ExpectedTotalJpy,
	})

	if err == nil {
		status := http.StatusCreated // 201: 新規作成
		if result.Replayed {
			status = http.StatusOK // 200: 冪等リプレイ(作成していない)
		}
		writeJSON(w, status, map[string]any{
			"id": result.OrderID, "status": result.Status,
			"total_jpy": result.TotalJpy, "shipping_fee_jpy": result.ShippingFeeJpy,
		})
		return
	}

	// ---- エラー→HTTPステータスの対応表(設計の核) ----
	var stockErr *orders.InsufficientStockError
	var priceErr *orders.PriceMismatchError
	switch {
	case errors.Is(err, orders.ErrInvalidAddress):
		// 形式は正しいが意味的に処理不能(他人の住所・存在しない住所)
		writeError(w, http.StatusUnprocessableEntity, "invalid_address", nil)
	case errors.As(err, &stockErr):
		// リソースの現在状態との衝突。数量を変えれば再試行できる
		writeError(w, http.StatusConflict, "insufficient_stock", map[string]any{"product_id": stockErr.ProductID})
	case errors.As(err, &priceErr):
		// 価格改定検知(CLAUDE.mdで確定済みの409)。新旧金額を返しUXに委ねる
		writeError(w, http.StatusConflict, "price_changed", map[string]any{
			"expected_total_jpy": priceErr.Expected, "actual_total_jpy": priceErr.Actual,
		})
	case errors.Is(err, orders.ErrIdempotencyKeyConflict):
		// キーは衝突したが自分の注文ではない(他人のキー or user_id 取り違え)。
		// 注文の中身は一切返さない
		writeError(w, http.StatusConflict, "idempotency_key_conflict", nil)
	case errors.Is(err, orders.ErrTotalTooLarge):
		writeError(w, http.StatusUnprocessableEntity, "total_too_large", nil)
	default:
		// コードは固定文字列のみ返し、詳細はサーバーログへ(内部情報の露出防止と両立)
		log.Printf("POST /orders internal error: %v", err)
		writeError(w, http.StatusInternalServerError, "internal_error", nil)
	}
}

func writeJSON(w http.ResponseWriter, status int, body map[string]any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(body)
}

func writeError(w http.ResponseWriter, status int, code string, extra map[string]any) {
	body := map[string]any{"error": code}
	for k, v := range extra {
		body[k] = v
	}
	writeJSON(w, status, body)
}
