package handler

import (
	"log"
	"net/http"

	"github.com/jackc/pgx/v5/pgxpool"

	"ec-learning/api/internal/db"
)

type Categories struct {
	Pool *pgxpool.Pool
}

// GET /categories
// 読み取り専用・単一クエリなので handler から db を直呼びする(層深度ルール)
func (h *Categories) List(w http.ResponseWriter, r *http.Request) {
	rows, err := db.New(h.Pool).ListCategories(r.Context())
	if err != nil {
		log.Printf("GET /categories internal error: %v", err)
		writeError(w, http.StatusInternalServerError, "internal_error", nil)
		return
	}

	type categoryJSON struct {
		ID       int64  `json:"id"`
		Name     string `json:"name"`
		ParentID *int64 `json:"parent_id"` // null = 大分類(ルート)
	}
	list := make([]categoryJSON, 0, len(rows))
	for _, row := range rows {
		c := categoryJSON{ID: row.ID, Name: row.Name}
		if row.ParentID.Valid {
			c.ParentID = &row.ParentID.Int64
		}
		list = append(list, c)
	}
	writeJSON(w, http.StatusOK, map[string]any{"categories": list})
}
