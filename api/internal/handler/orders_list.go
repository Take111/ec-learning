package handler

import (
	"encoding/base64"
	"errors"
	"fmt"
	"math"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgtype"

	"ec-learning/api/internal/db"
)

// カーソルの中身は (ordered_at, id) のペア。クライアントには base64 の不透明トークンとして
// 渡す。中身を晒さないのは「この形式に依存するな(変更の自由を守る)」という契約の表明。
// 前提: ソートキー (ordered_at DESC, id DESC) とカーソルの中身は常に一致させること。
//
//	ソート順を変えるならカーソルの中身も変わる(ADR 006)
func encodeCursor(t time.Time, id int64) string {
	raw := fmt.Sprintf("%s|%d", t.Format(time.RFC3339Nano), id)
	return base64.RawURLEncoding.EncodeToString([]byte(raw))
}

func decodeCursor(s string) (pgtype.Timestamptz, int64, error) {
	raw, err := base64.RawURLEncoding.DecodeString(s)
	if err != nil {
		return pgtype.Timestamptz{}, 0, err
	}
	part := strings.SplitN(string(raw), "|", 2)
	if len(part) != 2 {
		return pgtype.Timestamptz{}, 0, errors.New("malformed cursor")
	}
	t, err := time.Parse(time.RFC3339Nano, part[0])
	if err != nil {
		return pgtype.Timestamptz{}, 0, err
	}
	id, err := strconv.ParseInt(part[1], 10, 64)
	if err != nil {
		return pgtype.Timestamptz{}, 0, err
	}
	return pgtype.Timestamptz{Time: t, Valid: true}, id, nil
}

// GET /orders?user_id=&limit=&cursor=
func (h *Orders) ListByUser(w http.ResponseWriter, r *http.Request) {
	userID, err := strconv.ParseInt(r.URL.Query().Get("user_id"), 10, 64)
	if err != nil || userID <= 0 {
		writeError(w, http.StatusBadRequest, "missing_or_invalid_user_id", nil)
		return
	}

	limit := 20 // デフォルト。上限100はDoS的な巨大ページ要求への防衛
	if v := r.URL.Query().Get("limit"); v != "" {
		n, err := strconv.Atoi(v)
		if err != nil || n <= 0 || n > 100 {
			writeError(w, http.StatusBadRequest, "invalid_limit", nil)
			return
		}
		limit = n
	}

	// 1ページ目はカーソルなし = 境界を (infinity, int64最大) にして条件を無効化する
	// (「1ページ目クエリ」を別に持たず、境界値でSQLを1本に保つ)
	cursorAt := pgtype.Timestamptz{InfinityModifier: pgtype.Infinity, Valid: true}
	cursorID := int64(math.MaxInt64)
	if v := r.URL.Query().Get("cursor"); v != "" {
		cursorAt, cursorID, err = decodeCursor(v)
		if err != nil {
			writeError(w, http.StatusBadRequest, "invalid_cursor", nil)
			return
		}
	}

	rows, err := db.New(h.Pool).ListOrdersByUser(r.Context(), db.ListOrdersByUserParams{
		UserID:          userID,
		CursorOrderedAt: cursorAt,
		CursorID:        cursorID,
		PageSize:        int32(limit),
	})
	if err != nil {
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

	// 次ページの有無: 満杯なら「まだあるかもしれない」として最終行からカーソルを発行。
	// 端数ページなら終端(next_cursor: null)
	var nextCursor *string
	if len(rows) == limit {
		last := rows[len(rows)-1]
		c := encodeCursor(last.OrderedAt.Time, last.ID)
		nextCursor = &c
	}

	writeJSON(w, http.StatusOK, map[string]any{"orders": list, "next_cursor": nextCursor})
}
