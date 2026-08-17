-- q4: 都道府県 × 大分類カテゴリ別売上(全期間)
--
-- ■ 要件(この下に SQL を書く)
--   - 配送先都道府県(orders.ship_to_prefecture)× 大分類カテゴリごとの売上合計を出す
--   - cancelled は除外
--   - 「大分類」= categories.parent_id IS NULL の階層。商品が属するのは小分類なので
--     親への持ち上げが必要
--   - 売上合計の降順、上位30行
--
-- ■ ヒント
--   - orders → order_items → products → categories(小分類)→ categories(大分類)
--     で、categories は2回登場する(自己結合)。階層が2段固定なので再帰CTEは不要
--
-- ■ 観察ポイント
--   - 4テーブル(実質5結合)で JOIN 順序をプランナがどう組むか(EXPLAINの木構造を下から読む)
--   - GROUP BY のキーが2列(47都道府県 × 10カテゴリ = 最大470グループ)のときの集計方式
--   - どのテーブルのスキャンが実行時間の支配項か(actual time をノードごとに見る)
SELECT
    o.ship_to_prefecture,
    c_parent.name AS category_name,
    SUM(oi.quantity * oi.unit_price_jpy) AS total_sales
FROM orders AS o
JOIN order_items AS oi ON o.id = oi.order_id
JOIN products AS p ON oi.product_id = p.id
JOIN categories AS c_child ON p.category_id = c_child.id
JOIN categories AS c_parent ON c_child.parent_id = c_parent.id
WHERE o.status != 'cancelled'
GROUP BY o.ship_to_prefecture, c_parent.name
ORDER BY total_sales DESC
LIMIT 30;

