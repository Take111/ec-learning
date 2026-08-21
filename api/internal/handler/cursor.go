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
)

// カーソルページネーションのプロトコル一式(ADR 006)。
// カーソルの中身は「(ソート用タイムスタンプ, id)」のペアを base64 にした不透明トークン。
// 中身を晒さないのは「この形式に依存するな(変更の自由を守る)」という契約の表明。
// 前提: 各エンドポイントのソートキー(<時刻列> DESC, id DESC)と、SQL側の行値比較
//       (<時刻列>, id) < (cursor_at, cursor_id) は、常にこのペアと一致させること。

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

// parseCursorParam は ?cursor= を解釈する。無指定(1ページ目)は番兵
// (infinity, int64最大) を返し、SQLの境界条件を自然に無効化する
// (「1ページ目クエリ」を別に持たず、境界値でSQLを1本に保つ)
func parseCursorParam(r *http.Request) (pgtype.Timestamptz, int64, error) {
	v := r.URL.Query().Get("cursor")
	if v == "" {
		return pgtype.Timestamptz{InfinityModifier: pgtype.Infinity, Valid: true}, math.MaxInt64, nil
	}
	return decodeCursor(v)
}

// parseLimit は ?limit= を解釈する。デフォルト20。上限100はDoS的な巨大ページ要求への防衛
func parseLimit(r *http.Request) (int, error) {
	v := r.URL.Query().Get("limit")
	if v == "" {
		return 20, nil
	}
	n, err := strconv.Atoi(v)
	if err != nil || n <= 0 || n > 100 {
		return 0, errors.New("invalid limit")
	}
	return n, nil
}

// fullPageCursor は「ページが満杯 = まだ次があるかもしれない」ときに呼び、
// 最終行から次ページのカーソルを発行する。端数ページ(終端)では呼ばず nil のままにする
func fullPageCursor(lastAt time.Time, lastID int64) *string {
	c := encodeCursor(lastAt, lastID)
	return &c
}
