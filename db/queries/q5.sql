-- q5: 平均評価4以上の商品検索(レビュー5件以上)
--
-- ■ 要件(この下に SQL を書く)
--   - 平均評価(rating)が 4.0 以上の商品を探す
--   - ただしレビューが5件未満の商品は除外(1件だけ★5、を排除する実務あるある)
--   - 商品名・平均評価・レビュー件数を、平均評価の降順 → 件数の降順で上位50件
--
-- ■ ヒント
--   - reviews(20万行)を product_id で GROUP BY し、HAVING で絞る
--
-- ■ 観察ポイント
--   - このデータのレビューはJ字分布(★5が48%)なので「avg >= 4」は絞り込みとして
--     ほぼ機能しない — HAVING が効くのは集計後だけ、という構造の体感
--   - GROUP BY 20万行のコストと、products との JOIN をどの段階でやるか
--   - 「平均評価」を毎回集計するのは正しい設計か?(非正規化やマテビューの議論の入口)
SELECT
    p.name AS product_name,
    AVG(r.rating) AS average_rating,
    COUNT(*) AS review_count
FROM reviews AS r
JOIN products AS p ON r.product_id = p.id
GROUP BY p.id
HAVING AVG(r.rating) >= 4.0 AND COUNT(*) >= 5
ORDER BY average_rating DESC, review_count DESC
LIMIT 50;

