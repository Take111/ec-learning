-- q1: 特定ユーザーの注文履歴(最新20件)
--
-- 実務での位置づけ: マイページの注文履歴画面。EC で最も叩かれるクエリの一つ
-- 予想: orders.user_id にインデックスがないので、30万行の Seq Scan +
--       全件ソートになるはず。LIMIT 20 なのに 30万行触るのが問題の本質
--
-- user_id = 78872 はこのデータ最多の 2,936 件を持つヘビーユーザー。
-- 一般ユーザー(例: user_id = 42、3件)と実行計画がどう違うかも後で比較する
SELECT id, status, total_jpy, ordered_at
FROM orders
WHERE user_id = 78872
ORDER BY ordered_at DESC
LIMIT 20;
