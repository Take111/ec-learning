#!/usr/bin/env bash
# CSV一括投入スクリプト: \copy → setval → (統計なしEXPLAIN) → ANALYZE → (統計ありEXPLAIN) → 検証
#
# 設計メモ:
#   - TRUNCATE してから入れるので何度でも再実行できる(冪等)
#   - FK制約は張ったまま投入する。1行ごとにPK参照チェックが走るぶん遅くなるが、
#     「FK孤児が存在しないこと」は制約自体が保証する(検証クエリ不要 = 仕組みで安全)。
#     実務の大規模ロードでは制約を落として後から張り直す手もある(速度が問題になったら議論)
#   - HEADER MATCH (PG15+): CSVのヘッダー行とテーブルの列名を照合。列順ズレを仕組みで検出
#   - ANALYZE の前後で同じクエリの EXPLAIN を保存する。統計がない状態のプランナが
#     どれだけ的外れな行数見積もりをするかを観察するため(比較すべきは推定行数であって実行時間ではない)
#   - ANALYZE のみで VACUUM はしない(意図的)。可視性マップが整わない状態で
#     Index Only Scan がどう劣化するかを後で観察したいため(A-6で回収)
set -euo pipefail
cd "$(dirname "$0")/.."

PSQL="docker compose exec -T db psql -U ec -d ec -v ON_ERROR_STOP=1"
MEASURE_DIR="docs/measurements"
mkdir -p "$MEASURE_DIR"

# ANALYZE前後の比較に使う代表クエリ(A-5のq1相当)。user_id=42 に意味はない(任意の一般ユーザー)
EXPLAIN_QUERY="EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM orders WHERE user_id = 42 ORDER BY ordered_at DESC LIMIT 20;"

echo "== 1/5 TRUNCATE(再実行を冪等にする)"
$PSQL -q -c "TRUNCATE users, user_addresses, categories, products,
             orders, order_items, payments, reviews RESTART IDENTITY CASCADE;"

echo "== 2/5 \\copy でFK依存順に投入"
$PSQL <<'SQL'
\timing on
\copy categories     FROM '/data/categories.csv'     WITH (FORMAT csv, HEADER MATCH)
\copy users          FROM '/data/users.csv'          WITH (FORMAT csv, HEADER MATCH)
\copy user_addresses FROM '/data/user_addresses.csv' WITH (FORMAT csv, HEADER MATCH)
\copy products       FROM '/data/products.csv'       WITH (FORMAT csv, HEADER MATCH)
\copy orders         FROM '/data/orders.csv'         WITH (FORMAT csv, HEADER MATCH)
\copy order_items    FROM '/data/order_items.csv'    WITH (FORMAT csv, HEADER MATCH)
\copy payments       FROM '/data/payments.csv'       WITH (FORMAT csv, HEADER MATCH)
\copy reviews        FROM '/data/reviews.csv'        WITH (FORMAT csv, HEADER MATCH)
SQL

echo "== 3/5 setval(シーケンスを max(id) に進める。忘れると次のINSERTがPK重複で死ぬ)"
$PSQL -q <<'SQL'
SELECT setval(pg_get_serial_sequence('categories', 'id'),     (SELECT max(id) FROM categories));
SELECT setval(pg_get_serial_sequence('users', 'id'),          (SELECT max(id) FROM users));
SELECT setval(pg_get_serial_sequence('user_addresses', 'id'), (SELECT max(id) FROM user_addresses));
SELECT setval(pg_get_serial_sequence('products', 'id'),       (SELECT max(id) FROM products));
SELECT setval(pg_get_serial_sequence('orders', 'id'),         (SELECT max(id) FROM orders));
SELECT setval(pg_get_serial_sequence('order_items', 'id'),    (SELECT max(id) FROM order_items));
SELECT setval(pg_get_serial_sequence('payments', 'id'),       (SELECT max(id) FROM payments));
SELECT setval(pg_get_serial_sequence('reviews', 'id'),        (SELECT max(id) FROM reviews));
SQL

echo "== 4/5 ANALYZE前後の EXPLAIN を保存(推定行数の変化を比較するのが目的)"
{
  echo "-- ANALYZE 前(統計なし)。autovacuum が走る前に取ること"
  echo "-- $EXPLAIN_QUERY"
  $PSQL -Atq -c "$EXPLAIN_QUERY"
} > "$MEASURE_DIR/a4_explain_before_analyze.txt"

echo "   ANALYZE 実行中..."
$PSQL -q -c "ANALYZE;"

{
  echo "-- ANALYZE 後(統計あり)。上と同じクエリ"
  echo "-- $EXPLAIN_QUERY"
  $PSQL -Atq -c "$EXPLAIN_QUERY"
} > "$MEASURE_DIR/a4_explain_after_analyze.txt"

echo "== 5/5 検証"
$PSQL <<'SQL'
-- 件数
SELECT 'users' t, count(*) FROM users
UNION ALL SELECT 'user_addresses', count(*) FROM user_addresses
UNION ALL SELECT 'categories', count(*) FROM categories
UNION ALL SELECT 'products', count(*) FROM products
UNION ALL SELECT 'orders', count(*) FROM orders
UNION ALL SELECT 'order_items', count(*) FROM order_items
UNION ALL SELECT 'payments', count(*) FROM payments
UNION ALL SELECT 'reviews', count(*) FROM reviews;

-- 非正規化の整合: total_jpy = SUM(明細) + 送料 が全注文で成立するか(期待: 0)
SELECT count(*) AS total_jpy_mismatch FROM (
  SELECT o.id
  FROM orders o
  JOIN order_items oi ON oi.order_id = o.id
  GROUP BY o.id, o.total_jpy, o.shipping_fee_jpy
  HAVING o.total_jpy <> sum(oi.quantity * oi.unit_price_jpy) + o.shipping_fee_jpy
) mismatch;

-- 明細のない注文(期待: 0)
SELECT count(*) AS orders_without_items
FROM orders o WHERE NOT EXISTS (SELECT 1 FROM order_items oi WHERE oi.order_id = o.id);

-- setval の動作確認: シーケンスの現在値が max(id) と一致するか(次の発番は max+1)
SELECT 'orders_id_seq' AS seq, last_value, (SELECT max(id) FROM orders) AS max_id
FROM orders_id_seq;
SQL

echo "完了"
