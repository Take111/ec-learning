#!/usr/bin/env bash
# 連番マイグレーション適用スクリプト
# = golang-migrate 等のツールが内部でやっていることの最小再実装(学習目的)。
#   仕組み: schema_migrations テーブルに適用済み version を記録し、未適用の連番SQLだけを順に流す。
#   フェーズDで gomigrate(導入済み)に置き換えるかはこの自作経験をもとに判断する。
#
# 前提:
#   - マイグレーションファイルは BEGIN/COMMIT を書かない。
#     本体 + 履歴INSERT をまとめて --single-transaction で流す
#     (本体だけ成功して記録に失敗すると次回二重適用されるため、同一Txが必須)。
#   - CREATE INDEX CONCURRENTLY はトランザクション内で実行できない。
#     使いたくなったらこのスクリプトに「Txなしモード」が必要になる(今は不要)。
set -euo pipefail
cd "$(dirname "$0")/.."

psql_run() {
  docker compose exec -T db psql -U ec -d ec -v ON_ERROR_STOP=1 --quiet "$@"
}

# 適用履歴テーブル(このスクリプトが管理する唯一の状態)
psql_run -c "CREATE TABLE IF NOT EXISTS schema_migrations (
  version    TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);"

for file in db/migrations/[0-9]*.sql; do
  version=$(basename "$file" .sql)
  applied=$(psql_run -tA -c "SELECT 1 FROM schema_migrations WHERE version = '$version'")
  if [ "$applied" = "1" ]; then
    echo "skip:  $version (適用済み)"
    continue
  fi
  echo "apply: $version"
  { cat "$file"; echo "INSERT INTO schema_migrations (version) VALUES ('$version');"; } \
    | psql_run --single-transaction -f -
done
echo "done."
