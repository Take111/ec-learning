-- 007: idx_orders_ordered_at(005 B-tree)を削除 — BRIN(006)に一本化
--
-- ■ 要件(この下に SQL を書く)
--   - 005 で張った idx_orders_ordered_at を削除する
--
-- ■ この判断の根拠(コメントで残す)
--   - 実測: 直近30日の範囲集計で読み量ほぼ互角(B-tree 1,336p / BRIN 1,285p)、
--     サイズは BRIN が 1/261(24kB vs 6.3MB)、書き込み維持費もほぼゼロ
--   - ordered_at の用途は現状 q2 系の範囲集計のみ。証明済みの用途に最小の道具を残す
--   - 前提が変わる箇所:
--     - ORDER BY ordered_at を効かせたいクエリ(A-7 ページネーション等)が来たら
--       B-tree(おそらく (ordered_at, id) 複合)を改めて検討する
--     - correlation ≈ 1 が崩れる運用(UPDATE・乱順INSERT)になったら BRIN は無力化する
--
-- ■ 観察ポイント(適用後)
--   - mise run explain -- q2 brin-only で、ROLLBACK実験と同じ
--     Bitmap Heap Scan(lossy)プランになるか
DROP INDEX idx_orders_ordered_at;

