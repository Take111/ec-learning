#!/usr/bin/env bash
# EXPLAIN 計測スクリプト: db/queries/<name>.sql を EXPLAIN (ANALYZE, BUFFERS) で実行し、
# docs/measurements/<name>__<label>.txt に保存する。
#
# 使い方:  scripts/explain.sh q1 baseline
#          mise run explain -- q1 baseline
#   label はインデックス状態を表す(baseline / idx-orders-user-id など)。
#   同じクエリを label を変えて撮り直すことで before/after 比較の履歴が残る。
#
# 設計メモ:
#   - クエリファイルには素の SELECT だけを書く(EXPLAINはこちらで付ける)。
#     実行計画を見たいだけのときに psql へそのまま貼れるようにするため
#   - 同じクエリを2回実行して両方記録する。1回目と2回目の差 = キャッシュの効果
#     (Buffers: shared read → hit への変化)。実測値として意味があるのは主に2回目
set -euo pipefail
cd "$(dirname "$0")/.."

name="${1:?usage: explain.sh <query-name> [label]}"
label="${2:-adhoc}"
query_file="db/queries/${name}.sql"
out_file="docs/measurements/${name}__${label}.txt"

[ -f "$query_file" ] || { echo "not found: $query_file" >&2; exit 1; }

PSQL="docker compose exec -T db psql -U ec -d ec -v ON_ERROR_STOP=1 -Atq"
sql=$(cat "$query_file")

{
  echo "===================================================================="
  echo "query: $name    label: $label"
  echo "===================================================================="
  echo "$sql"
  echo
  echo "-------- 実行1回目(キャッシュが冷えていれば shared read が出る) --------"
  echo "EXPLAIN (ANALYZE, BUFFERS) $sql" | $PSQL
  echo
  echo "-------- 実行2回目(キャッシュ済み。実測値はこちらを基準にする) --------"
  echo "EXPLAIN (ANALYZE, BUFFERS) $sql" | $PSQL
} > "$out_file"

echo "saved: $out_file"
echo
# 2回目の結果だけ画面にも出す
sed -n '/実行2回目/,$p' "$out_file"
