package handler

import (
	"log"
	"net/http"
	"strconv"
	"time"

	"ec-learning/api/internal/db"
)

// GET /orders?user_id=&limit=&cursor=
func (h *Orders) ListByUser(w http.ResponseWriter, r *http.Request) {
	userID, err := strconv.ParseInt(r.URL.Query().Get("user_id"), 10, 64)
	if err != nil || userID <= 0 {
		writeError(w, http.StatusBadRequest, "missing_or_invalid_user_id", nil)
		return
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

	rows, err := db.New(h.Pool).ListOrdersByUser(r.Context(), db.ListOrdersByUserParams{
		UserID:          userID,
		CursorOrderedAt: cursorAt,
		CursorID:        cursorID,
		PageSize:        int32(limit),
	})
	if err != nil {
		log.Printf("GET /orders internal error: %v", err)
		writeError(w, http.StatusInternalServerError, "internal_error", nil)
		return
	}

	type orderJSON struct {
		ID             int64     `json:"id"`
		Status         string    `json:"status"`
		TotalJpy       int32     `json:"total_jpy"`
		ShippingFeeJpy int32     `json:"shipping_fee_jpy"`
		OrderedAt      time.Time `json:"ordered_at"`
	}
	list := make([]orderJSON, 0, len(rows))
	for _, row := range rows {
		list = append(list, orderJSON{
			ID: row.ID, Status: row.Status, TotalJpy: row.TotalJpy,
			ShippingFeeJpy: row.ShippingFeeJpy, OrderedAt: row.OrderedAt.Time,
		})
	}
	var nextCursor *string
	if len(rows) == limit {
		last := rows[len(rows)-1]
		nextCursor = fullPageCursor(last.OrderedAt.Time, last.ID)
	}
	writeJSON(w, http.StatusOK, map[string]any{"orders": list, "next_cursor": nextCursor})
}
