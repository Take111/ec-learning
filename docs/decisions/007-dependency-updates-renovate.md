# ADR 007: 依存更新は Renovate に任せる

- ステータス: 採用
- 日付: 2026-08-28

## 背景

公開リポジトリとして依存を放置しない仕組みが要る。対象は 5 つのエコシステムにまたがる
(dry-run 実測: 6 ファイル・51 依存):

| 場所 | manager | 中身 | 更新の性質 |
|---|---|---|---|
| `mise.toml` | mise | node / pnpm / go / golangci-lint / sqlc | major 表記は major PR のみ。sqlc は厳密固定なので patch PR が来る |
| `docker-compose.yml` | docker-compose | `postgres:18-alpine` | PG19 が stable になれば major PR。ADR 001 と volume 配置に直結 |
| `api/go.mod` | gomod | pgx v5 + indirect、`go` directive | pgx は実DBの統合テストが叩く |
| `mobile/package.json` | npm(pnpm) | Expo SDK 57 一式・RN 0.86・第三者ネイティブ lib | **SDK 連動パッケージを個別に上げると壊れる** |
| `tools/seed/package.json` | npm | faker / tsx | CI で seed は走らない → 検証手段なし |
| `.github/workflows/ci.yml` | github-actions | checkout / mise-action | タグ参照(SHA ピンは先送りしていた) |

ci.yml では「シークレットを追加する日が来たら SHA ピン + Dependabot」と先送りしていた。

## 選択肢

### ツール

1. **Dependabot** — GitHub 標準。設定が薄い分、グループ化・Expo のような
   エコシステム固有の制御が弱い。mise.toml / docker-compose の対応も限定的
2. **Renovate(Mend hosted App)** — 5 manager すべてに対応。packageRules で
   細かく制御でき、設定を JSON5 でコメント付きで残せる
3. **Renovate(self-hosted / GitHub Actions)** — 実行を握れてログも全部見える
   (ADR 003 の「ツールの内部を先に理解する」思想に合う)が、**PR 作成に write
   権限の PAT / App token が必要**。「露出シークレットは read-only の GITHUB_TOKEN
   のみ」というセキュリティレビューの防衛線を崩す。GITHUB_TOKEN で作った PR は
   CI が発火しない罠もある

### Expo SDK 連動パッケージ

- a. Renovate から除外し SDK 更新は完全手動 — 安全だが Renovate の意味が縮む
- b. 全部任せてグループ化だけ — RN 0.86→0.87 は semver 上 **minor** で major ガードを抜ける
- c. グループ化 + patch/minor 許可・major 禁止 — 当初案
- d. **グループ化 + patch のみ許可・exact ピンは触らない + CI で `expo install --check`** — 採用

## 決定

選択肢 2(hosted App)。「内部を理解したい」欲求は `mise run renovate-dry-run`
(`--platform=local`、PR を作らない)で検知結果と提案を先に読む、で満たす。
防衛線を崩さずに学べる。

| 論点 | 決定 | 根拠 |
|---|---|---|
| Expo SDK 連動 | d(patch のみ・exact ピン不可侵・CI ガード) | 下記「dry-run で分かったこと」 |
| 自動マージ | 当面なし(`config:recommended` の既定) | CI がテストで守っている範囲(Go patch・Actions)にしか使わない、と線を引いてから段階開放する |
| 頻度 | 週1(月曜早朝 JST)+ Dependency Dashboard | ノイズ制御。脆弱性(OSV)はスケジュール外で即 PR |
| major | Dashboard 承認制(`dependencyDashboardApproval`) | node 24 / pnpm 11 / TS 7 / eslint 10 は意思決定してから PR を作る |
| Actions の SHA ピン | 今やる(`helpers:pinGitHubActionDigests`) | Renovate が保守するなら先送りしていたコストがゼロになる |
| postgres major | 止める | 学習の実測基盤と volume 配置(ADR 001)。上げるときは ADR を書き直してから手で |
| go directive(go.mod) | 更新しない(既定でも無効、明示) | 「ツールの版は mise.toml が唯一の情報源」 |
| mise の go | `versioning: npm` + 承認制 | Renovate は `"1.25"` を `"1.27.0"` と精度を落として書く。Go の minor は実質メジャー |
| sqlc | 単独 PR | 版が動くと生成物が変わりうる。CI の乖離チェックで赤くなったら `mise run sqlc` の再生成コミットを足す |
| rangeStrategy(npm) | `bump` | 既定の update-lockfile だと lockfile だけ動いて差分が読めない |
| `minimumReleaseAge` | 3 days | 公開直後の悪性バージョン対策(公開リポの防衛線に一貫) |
| 設定ファイル | `renovate.json5` | コメントで前提条件を残す規約を設定にも適用 |

### dry-run で分かったこと(設計を変えた証拠)

当初案 c は「patch/minor 許可」だったが、`--platform=local` の実測で minor が危険だと判明した:

- Renovate は `react-native 0.86.2 → 0.87.1`、`react-native-screens ~4.26 → ~4.27`、
  `safe-area-context ~5.7 → ~5.9`、`worklets 0.10 → 0.12` を **minor** として提案する。
  いずれも `expo install --check` の期待(RN 0.86.3、screens ~4.26.0 …)の外
- `react` / `react-native` / `reanimated` / `worklets` は `bundledNativeModules.json` でも
  **exact** 指定 = Expo が版そのものを決めている。patch でも Renovate が触るべきでない
- SDK 連動の集合は推測ではなく `node_modules/expo/bundledNativeModules.json` ∩ package.json
  で決めた(+ `expo` 本体)。`@types/react` / `typescript` / `@tanstack/react-query` /
  `zustand` / `eslint` / `agent-device` は非管理
- 設定後の再 dry-run で検証済み: exact ピン 5 件は lookup 段階で `disabled`、screens / safe-area /
  gesture-handler の minor・major は packageRules 適用後の一覧(28 件)から消え、SDK 連動で残るのは
  `~` レンジの patch(`~57.0.15 → ~57.0.16` 等)のみ。mise の go は `1.25 → 1.27` と精度を保った
- 落とし穴: `--platform=local` はファイル一覧を git から取るため、設定ファイルは `git add` 済みで
  ないと「No renovate config file found」で onboarding 既定の結果になる(1 回踏んだ)

### CI ガードの当て方

`expo install --check` は「SDK が *いま* 期待する版か」を見るため、Expo 側のパッチ公開の
たびに古くなる(導入時点で既に 10 件が「古い」判定)。全 PR で走らせると無関係な PR や
main まで赤くなるので、**Renovate の `renovate/expo-sdk` ブランチに限定**して走らせる。
Renovate は互換表を知らない → CI が判定する、という役割分担(規律ではなく仕組みで止める)。

赤の意味は 2 通りある。(1) Renovate の提案が SDK の期待外(設定ミスの検知)。
(2) exact ピン(react-native / react / reanimated / worklets)の期待を Expo が動かした —
これは Renovate の対象外なので PR には含まれず、`npx expo install --fix` を Renovate の
ブランチに足してからマージする。導入時点で既に RN 0.86.2 → 期待 0.86.3 の drift があり、
**初回の expo-sdk PR は赤になる**(この手順の初回実演になる)。

## 既知の限界(意図的に未対応)

- seed(`tools/seed`)の更新 PR は CI で検証されない。マージ前に `mise run seed` を手で回す
- `lockFileMaintenance`(推移的依存の一括更新)は未有効。実行時テストのない mobile で
  lockfile 全体が動くのを避けた。必要になったら月1で有効化
- `jdx/mise-action` の mise 自体の版は未固定(`with: version` を書けば Renovate が追従する)
- Renovate 最新版はローカル実行に Node 24 を要求する(mise.toml は node 22)。
  `scripts/renovate-dry-run.sh` は `mise x node@24` で一時的に 24 を使う
- Renovate のコミットメッセージは英語(`chore(deps): …`)のまま。このリポの日本語規約と
  混在するが、bot の差分だと一目で分かる利点を取る

## この判断が覆る条件

- 自動マージ: Go patch と Actions は CI が守っているので、数週間 PR の質を見てから開放する
- self-hosted への移行: 実行タイミングを自分で握る必要が出たとき(hosted は Mend 側の
  スケジュール)。その場合は write 権限トークンの置き方を先に決める
- Expo の patch 許可をやめる: `renovate/expo-sdk` の PR が繰り返し赤くなる(Expo の
  期待が exact 寄りに変わる)なら、選択肢 a(完全手動)に戻す
- Expo SDK のライン移動(57→58)は Renovate の対象外のまま。`npx expo install --fix` +
  `mise run mobile-expo-check` で行い、必要なら renovate.json5 の集合を見直す
