-- 商品API用のSQL(B-6: フェーズCの前提)
--
-- ========================================================================

-- name: ListProducts :many
-- ■ 要件(この下に SQL を書く)
--   - アクティブな商品(is_active = true)を新着順(created_at DESC, id DESC)で返す
--   - カーソル: (created_at, id) の行値比較(B-5 と同じ形。キャストも同様に必要)
--     パラメータ名: cursor_created_at / cursor_id / page_size
--   - カテゴリ絞り込み: sqlc.arg(category_id) が 0 なら全件、0以外ならその小分類のみ
--     ヒント: (sqlc.arg(category_id)::bigint = 0 OR category_id = sqlc.arg(category_id))
--     ※「0=指定なし」の番兵方式。NULLを使う方式もあるがsqlcの型がポインタになるため今回は番兵
--   - 返す列: id, category_id, name, price_jpy, stock
--
-- ■ 観察ポイント
--   - 5万行に対しこの絞り込み+カーソルはどのインデックスを使うか(現状 products は PK のみ)
--     → 遅ければフェーズAの手順(実測→設計→張る)をここでも回す
SELECT id, category_id, name, price_jpy, stock, created_at
FROM products
WHERE is_active = true
  -- 前提: この OR はインデックス条件になれない(generic plan で全行Filterに落ちる。実測済み)。
  --       category_id にインデックスを張る段階で、全件用/カテゴリ用の2クエリへの分割が争点になる
  AND (sqlc.arg(category_id)::bigint = 0 OR category_id = sqlc.arg(category_id))
  AND (created_at, id) < (sqlc.arg(cursor_created_at)::timestamptz, sqlc.arg(cursor_id)::bigint)
ORDER BY created_at DESC, id DESC
LIMIT sqlc.arg(page_size);


-- name: GetProductDetail :one
-- ■ 要件(この下に SQL を書く)
--   - 商品1件(sqlc.arg(product_id))の詳細 + レビュー集計を1クエリで返す
--   - 返す列: id, category_id, name, description, price_jpy, stock, is_active,
--             avg_rating(平均評価、レビュー0件なら NULL), review_count(件数)
--   - ヒント: reviews への LEFT JOIN + GROUP BY。q5 で書いた集計の1商品版。
--     avg(rating) の型が numeric になるので ::float8 キャストすると Go 側が扱いやすい
--
-- ■ 観察ポイント
--   - idx_reviews_covering(product_id) INCLUDE (rating) がここでも効くか
SELECT p.id, p.category_id, p.name, p.description, p.price_jpy, p.stock, p.is_active,
       -- COALESCE する理由: レビュー0件だと avg は NULL になり、sqlc/Goの float64 に
       -- スキャンできず実行時エラー。JSON上の null は handler が review_count=0 から導出する
       COALESCE(avg(r.rating), 0)::float8 AS avg_rating,
       -- count(*) ではなく非NULL列を数える理由: レビュー0件のとき LEFT JOIN は
       -- 「NULLだけの1行」を作るため count(*) だと 1 になる。
       -- r.id ではなく r.rating を数える理由: rating は idx_reviews_covering の INCLUDE に
       -- 入っており Index Only Scan が成立する(r.id だとヒープ読みに落ち Buffers 58倍。実測済み)
       count(r.rating) AS review_count
FROM products p
LEFT JOIN reviews r ON r.product_id = p.id
WHERE p.id = sqlc.arg(product_id)
GROUP BY p.id;
