-- q3b: 商品別売上ランキング(q3 の書き換え実験 —「集計してから JOIN」)
--
-- ■ 要件(この下に SQL を書く)
--   - 結果は q3 と完全に同一であること(直近90日・cancelled除外・上位20・商品名つき降順)
--   - ただし処理順を変える:
--       1. order_items JOIN orders だけで product_id ごとに売上を集計する
--       2. 上位20件に絞ってから products を JOIN して名前を引く
--
-- ■ ヒント
--   - サブクエリ(または CTE)で「product_id, total_sales の上位20行」を先に作る
--   - LIMIT をサブクエリの内側に置くのがキモ(外側に置くと5万行全部が products と JOIN される)
--   - 外側にも ORDER BY を忘れずに(サブクエリの順序は外側で保証されない)
--
-- ■ 観察ポイント(q3 の baseline と比較する)
--   - products との JOIN が「44万行を担いだ Hash Join」から「20行の Nested Loop + PK参照」に変わるか
--   - Partial/Finalize HashAggregate のメモリ使用量(担ぐ列が減る効果)
--   - Execution Time と Buffers の差分 — この書き換えは何を減らして、何を減らせないか
--   - PostgreSQL が eager aggregation を自動でやらない、という事実の体感
SELECT
    p.name AS product_name,
    t.total_sales
FROM (
    SELECT
        oi.product_id,
        SUM(oi.quantity * oi.unit_price_jpy) AS total_sales
    FROM order_items AS oi
    JOIN orders AS o ON oi.order_id = o.id
    WHERE o.ordered_at >= now() - interval '90 days'
      AND o.status != 'cancelled'
    GROUP BY oi.product_id
    ORDER BY total_sales DESC
    LIMIT 20
) AS t
JOIN products AS p ON t.product_id = p.id
ORDER BY t.total_sales DESC;

