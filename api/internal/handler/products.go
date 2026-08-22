package handler

import (
	"log"
	"errors"
	"net/http"
	"strconv"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"ec-learning/api/internal/db"
)

type Products struct {
	Pool *pgxpool.Pool
}

// GET /products?category_id=&limit=&cursor=
func (h *Products) List(w http.ResponseWriter, r *http.Request) {
	var categoryID int64 // 0 = 絞り込みなし(SQL側の番兵方式と対応)
	if v := r.URL.Query().Get("category_id"); v != "" {
		n, err := strconv.ParseInt(v, 10, 64)
		if err != nil || n <= 0 {
			writeError(w, http.StatusBadRequest, "invalid_category_id", nil)
			return
		}
		categoryID = n
	}
	limit, err := parseLimit(r)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid_limit", nil)
		return
	}
	cursorAt, cursorID, err := parseCursorParam(r)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid_cursor", nil)
		return
	}

	rows, err := db.New(h.Pool).ListProducts(r.Context(), db.ListProductsParams{
		CategoryID:      categoryID,
		CursorCreatedAt: cursorAt,
		CursorID:        cursorID,
		PageSize:        int32(limit),
	})
	if err != nil {
		log.Printf("products internal error: %v", err)
		writeError(w, http.StatusInternalServerError, "internal_error", nil)
		return
	}

	type productJSON struct {
		ID         int64  `json:"id"`
		CategoryID int64  `json:"category_id"`
		Name       string `json:"name"`
		PriceJpy   int32  `json:"price_jpy"`
		Stock      int32  `json:"stock"`
	}
	list := make([]productJSON, 0, len(rows))
	for _, row := range rows {
		list = append(list, productJSON{
			ID: row.ID, CategoryID: row.CategoryID, Name: row.Name,
			PriceJpy: row.PriceJpy, Stock: row.Stock,
		})
	}
	var nextCursor *string
	if len(rows) == limit {
		last := rows[len(rows)-1]
		nextCursor = fullPageCursor(last.CreatedAt.Time, last.ID)
	}
	writeJSON(w, http.StatusOK, map[string]any{"products": list, "next_cursor": nextCursor})
}

// GET /products/{id}
func (h *Products) Detail(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil || id <= 0 {
		writeError(w, http.StatusBadRequest, "invalid_product_id", nil)
		return
	}
	row, err := db.New(h.Pool).GetProductDetail(r.Context(), id)
	if errors.Is(err, pgx.ErrNoRows) {
		writeError(w, http.StatusNotFound, "product_not_found", nil)
		return
	}
	if err != nil {
		log.Printf("products internal error: %v", err)
		writeError(w, http.StatusInternalServerError, "internal_error", nil)
		return
	}

	// レビュー0件のとき avg_rating は null(SQLのCOALESCE 0 をAPI契約に漏らさない。
	// COALESCE を使う理由は products.sql 側のコメント参照 — sqlcの非null誤推論の回避)
	var avg *float64
	if row.ReviewCount > 0 {
		avg = &row.AvgRating
	}
	var desc *string
	if row.Description.Valid {
		desc = &row.Description.String
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"id": row.ID, "category_id": row.CategoryID, "name": row.Name,
		"description": desc, "price_jpy": row.PriceJpy, "stock": row.Stock,
		"is_active": row.IsActive, "avg_rating": avg, "review_count": row.ReviewCount,
	})
}
