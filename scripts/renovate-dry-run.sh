#!/usr/bin/env bash
# Renovate をローカルで dry-run し、「どのファイルから何を検知し、何を提案するか」を表で出す。
# --platform=local は現在のディレクトリを対象に lookup までを行い、PR も issue も作らない。
# renovate.json5 を変えたら、App の週次実行を待たずにこれで結果を先に見る(ADR 007)。
#
# 前提:
#   - Renovate 最新版は Node 24 を要求する(mise.toml の node 22 だと RegExp.escape が無くて落ちる)。
#     mise.toml は変えず、mise x node@24 で一時的に 24 を使う
#   - GitHub Actions のタグ解決に GitHub API を叩くので、gh のトークンを GITHUB_COM_TOKEN として渡す
#     (未ログインでも動くが、無認証のレート制限に当たることがある)
#   - jq が必要(表の整形に使う)
#   - renovate.json5 は git に追跡(少なくとも git add)されている必要がある。local platform はファイル一覧を
#     git から取るため、未追跡だと「No renovate config file found」で onboarding 既定の結果になる(実際に踏んだ)
set -euo pipefail
cd "$(dirname "$0")/.."

command -v jq >/dev/null || { echo "jq が必要です(brew install jq)" >&2; exit 1; }

out="$(mktemp -t renovate-dryrun.XXXXXX)"
echo "Renovate dry-run 実行中(初回は renovate の取得に数分かかる)… ログ: $out" >&2

GITHUB_COM_TOKEN="${GITHUB_COM_TOKEN:-$(gh auth token 2>/dev/null || true)}" \
LOG_LEVEL=debug LOG_FORMAT=json \
  mise x node@24 -- npx --yes renovate@latest --platform=local > "$out"

# 設定ミス・取得失敗は WARN 以上で出る(RE2 のネイティブモジュール警告と local 非対応の preset 警告は既知なので除く)
jq -r 'select(.level >= 40) | "WARN/ERROR: \(.msg)"' "$out" | grep -v -e 'RE2 not usable' -e 'local presets' || true

echo
echo "== 検知した依存と lookup 直後の提案(updateType:newValue。空欄 = 最新)=="
echo "   ※ matchUpdateTypes 系の packageRules(minor/major 禁止など)はこの後の branchify 段階で効くため、この表には反映されない"
jq -r '
  select(.msg == "packageFiles with updates") | .config
  | to_entries[] | .key as $m | .value[] | .packageFile as $f | .deps[]
  | [ $m, $f, .depName, (.depType // "-"), (.currentValue // "-"),
      ((.updates // []) | map("\(.updateType):\(.newValue // (.newDigest // "")[0:7])") | join(" ")),
      (.skipReason // "") ]
  | @tsv' "$out" \
  | (printf 'manager\tfile\tdep\ttype\tcurrent\tupdates\tskip\n'; cat) \
  | column -t -s $'\t'

echo
echo "== packageRules 適用後に残る更新(これが PR の材料。グループ分けとブランチ名はローカルでは見えない → Dependency Dashboard で確認)=="
jq -r 'select(.msg | test("flattened updates found")) | .msg' "$out" \
  | sed -e 's/^[0-9]* flattened updates found: //' -e 's/, /\n/g' | sort | uniq -c | sort -rn
