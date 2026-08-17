-- q2: 期間指定の売上集計(直近30日・日別)
--
-- ■ 要件(この下に SQL を書く)
--   - 直近30日間の注文を対象に、日別の「注文件数」と「売上合計(total_jpy)」を出す
--   - cancelled は売上に含めない
--   - 日付昇順で並べる
--
-- ■ ヒント
--   - 「日別」への丸め: date_trunc('day', ordered_at)
--   - 「直近30日」の基準は now() でよい(データは2026-08-17直前まで入っている)
--
-- ■ 観察ポイント
--   - ordered_at の範囲条件が Seq Scan + Filter になること
--   - 推定行数と実行行数のズレ(直近偏重の分布をプランナがどう見積もるか)
--   - 集計(GROUP BY)が HashAggregate と Sort のどちらになるか
SELECT
    date_trunc('day', ordered_at, 'Asia/Tokyo') AS order_date,
    COUNT(*) AS order_count,
    SUM(total_jpy) AS total_sales
FROM orders
WHERE ordered_at >= now() - interval '30 days'
  AND status != 'cancelled'
GROUP BY order_date
ORDER BY order_date ASC;
