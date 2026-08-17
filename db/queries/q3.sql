-- q3: 商品別売上ランキング(直近90日・上位20)
--
-- ■ 要件(この下に SQL を書く)
--   - 直近90日の注文を対象に、商品ごとの売上金額 = SUM(quantity * unit_price_jpy) を集計
--   - cancelled は除外
--   - 売上金額の上位20商品を、商品名とともに表示(降順)
--
-- ■ ヒント
--   - order_items(120万行) JOIN orders(30万行) JOIN products
--   - 金額は order_items のスナップショット価格を使う(products.price_jpy を使うと
--     価格改定後の値で過去の売上を計算してしまう — スナップショット原理の実践)
--
-- ■ 観察ポイント
--   - 120万行テーブルが絡んで初めて「秒オーダーの遅さ」が出るか
--   - JOIN 方式(Hash Join / Merge Join / Nested Loop)と、どちらが外側になるか
--   - 期間で絞ってから JOIN するか、JOIN してから絞るかをプランナがどう判断するか
SELECT
    p.name AS product_name,
    SUM(oi.quantity * oi.unit_price_jpy) AS total_sales
FROM order_items AS oi
JOIN orders AS o ON oi.order_id = o.id
JOIN products AS p ON oi.product_id = p.id
WHERE o.ordered_at >= now() - interval '90 days'
  AND o.status != 'cancelled'
GROUP BY p.id
ORDER BY total_sales DESC
LIMIT 20;
