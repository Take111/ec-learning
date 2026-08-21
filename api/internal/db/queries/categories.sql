-- name: ListCategories :many
-- カテゴリ全件(50件のマスタデータ)。階層はクライアント側で parent_id から組む。
-- 前提: カテゴリは2階層固定(大分類10 + 子40)・件数が小さいのでページネーション不要。
--   階層が深くなる/件数が増えるなら、再帰CTEでツリーを組んで返す設計に変わる
SELECT id, name, parent_id
FROM categories
ORDER BY parent_id NULLS FIRST, id;
