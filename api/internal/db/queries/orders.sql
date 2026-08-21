-- POST /orders の注文トランザクションを構成するSQL(B-1)
--
-- ■ sqlc の書き方(B-2 でGo関数に生成される)
--   - 各クエリの直前に注釈を書く:  -- name: CreateOrder :one
--     :one = 1行返す / :many = 複数行 / :exec = 行を返さない / :execrows = 影響行数を返す
--   - パラメータは $1, $2, ... の位置指定
--
-- ■ トランザクション全体の設計(ADR相当の前提。B-3 のGo側でこの順に呼ぶ)
--   1. CreateOrder      — 冪等キー付き仮INSERT(total=0)。ここで冪等性が確定
--   2. (衝突時) GetOrderByIdempotencyKey — 既存注文を返してリトライを吸収
--   3. DecrementStock   — 商品ごとに在庫引き当て(アトミック)。0行なら在庫不足→全体ロールバック
--   4. InsertOrderItem  — その時点の価格でスナップショット
--   5. FinalizeOrder    — サーバー計算の合計で確定UPDATE(同一Tx内なので外からは見えない)
--
-- ========================================================================

-- name: CreateOrder :one
-- ■ 要件
--   - orders に仮INSERT: idempotency_key($1), user_id($2), status='pending',
--     total_jpy=0, shipping_fee_jpy=0, ordered_at=now()
--   - 配送先は user_addresses から丸ごとコピー(スナップショット)。
--     住所は address_id($3) で指定されるが、**そのユーザーの住所であること**を
--     SQLで保証すること(他人の住所IDを渡されたら0行になる形)
--   - 冪等キーが衝突したら**エラーにせず0行を返す**形にする
--   - 挿入できたら id を返す
-- ■ ヒント
--   - INSERT INTO ... SELECT ... FROM user_addresses WHERE ... の形
--   - ON CONFLICT (idempotency_key) DO NOTHING
--   - RETURNING id
-- ■ 観察ポイント(B-3で効いてくる)
--   - この設計だと「0行」が2つの意味を持つ(キー衝突 or 住所不正)。
--     Go側でどう見分けるかはB-3の議論(ヒント: 衝突なら次のクエリで見つかる)
INSERT INTO orders (idempotency_key, user_id, status, total_jpy, shipping_fee_jpy, ordered_at,
                    ship_to_postal_code, ship_to_prefecture, ship_to_line1, ship_to_line2)
SELECT sqlc.arg(idempotency_key), sqlc.arg(user_id), 'pending', 0, 0, now(),
       postal_code, prefecture, line1, line2
FROM user_addresses
WHERE user_addresses.id = sqlc.arg(address_id) AND user_addresses.user_id = sqlc.arg(user_id)
ON CONFLICT (idempotency_key) DO NOTHING
RETURNING id, status;


-- name: GetOrderByIdempotencyKey :one
-- ■ 要件
--   - idempotency_key($1) で既存注文を1行取得(id, status, total_jpy を返す)
--   - リトライ吸収の応答(200で既存注文を返す)に使う
SELECT id, status, total_jpy, shipping_fee_jpy
FROM orders
WHERE idempotency_key = $1;


-- name: DecrementStock :one
-- ■ 要件
--   - product_id($1) の在庫を quantity($2) 減らす。ただし
--     「在庫が足りる」「is_active である」場合のみ
--   - チェックと更新を1文で行う(SELECT→UPDATE分離はTOCTOUで在庫マイナス事故)
--   - 更新できたら**その時点の price_jpy を返す**(スナップショット価格の出どころ)
--   - 0行 = 在庫不足 or 無効商品 → Go側でトランザクション全体をロールバック
-- ■ ヒント
--   - UPDATE ... SET stock = stock - $2 WHERE ... AND stock >= $2 ... RETURNING ...
--   - 行ロックは UPDATE が自動で取る。同じ商品への並行注文は片方が待たされ、
--     待ち明けに WHERE を再評価する — これが「仕組みで安全」の中身(B-4で並行実証)
UPDATE products
SET stock = stock - sqlc.arg(quantity)
WHERE products.id = sqlc.arg(product_id) AND products.stock >= sqlc.arg(quantity) AND products.is_active = true
RETURNING price_jpy;


-- name: InsertOrderItem :exec
-- ■ 要件
--   - order_items に1行: order_id($1), product_id($2), quantity($3), unit_price_jpy($4)
--   - unit_price_jpy には DecrementStock が返した価格を渡す(products を再読みしない)
INSERT INTO order_items (order_id, product_id, quantity, unit_price_jpy)
VALUES ($1, $2, $3, $4);

-- name: FinalizeOrder :exec
-- ■ 要件
--   - orders の total_jpy($2), shipping_fee_jpy($3) を id($1) で確定UPDATE
--   - 合計・送料の計算はGo側(サーバーが金額を決める原則)。
--     送料ルール: 小計5,000円以上は無料、未満は550円(データ生成と同じルール)
UPDATE orders
SET total_jpy = $2, shipping_fee_jpy = $3
WHERE id = $1;


-- name: ListOrdersByUser :many
-- ■ 要件(B-5: GET /orders のカーソルページネーション。この下に SQL を書く)
--   - user_id(sqlc.arg(user_id))の注文を新しい順に page_size 件返す
--   - 返す列: id, status, total_jpy, ordered_at
--   - カーソル条件: (ordered_at, id) が (sqlc.arg(cursor_ordered_at), sqlc.arg(cursor_id))
--     より「前」の行だけ(行値比較。A-7 で実測したやつがそのまま使える)
--   - 並び: ordered_at DESC, id DESC(タイブレークまで含めた全順序 — ADR 006)
--   - LIMIT は sqlc.arg(page_size)
--
-- ■ ヒント
--   - 1ページ目(カーソルなし)の扱い: Go側から cursor_ordered_at = 'infinity'、
--     cursor_id = int64最大値 を渡す設計にする(全行が (infinity, max) より前なので
--     条件が自然に無効化される。クエリを2本に分けなくて済む)
--
-- ■ 観察ポイント(実装後に EXPLAIN で確認)
--   - 既存の idx_orders_user_id_ordered_at(user_id, ordered_at)で足りるか?
--     カーソルのタイブレークには id が要るが、インデックスに id 列は無い。
--     プランに Filter が残るか、(user_id, ordered_at, id) への張り替え(013)が要るかは
--     EXPLAIN が教えてくれる
SELECT id, status, total_jpy, shipping_fee_jpy, ordered_at
FROM orders
WHERE user_id = sqlc.arg(user_id) AND (ordered_at, id) < (sqlc.arg(cursor_ordered_at)::timestamptz, sqlc.arg(cursor_id)::bigint)
ORDER BY ordered_at DESC, id DESC
LIMIT sqlc.arg(page_size);