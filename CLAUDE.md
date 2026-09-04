# CLAUDE.md — 架空EC学習プロジェクト

## このプロジェクトは何か

架空のECサイトをフルスタックで構築する**学習プロジェクト**。成果物より学習が目的。

- 主目的: バックエンド構築の学習(実務レベルのSQL・API設計)
- フロント(フェーズC)は**公開ポートフォリオとして仕上げる**(2026-08-21に方針変更。
  当初の「適当でよい」を撤回 — RN専門家としての見せ場も兼ねる。エラー系UX
  (409ダイアログ・冪等リトライ・カーソル無限スクロール)はAPI設計の実演として特に丁寧に)
- 100万件規模のデータを生成し、クエリ性能を実測しながら学ぶ

## 進め方のルール(重要)

**完成コードをいきなり渡さないこと。**

- 設計判断が必要な場面では「選択肢 → トレードオフ → 推奨案」を提示し、ユーザー自身に決めさせる
- ユーザーのゴールは「なぜその設計にしたのか自分の言葉で説明できる状態」になること
- ユーザーはモバイルエンジニア(iOS/RN/Flutter 6〜7年)。クライアント側の経験は深いので、その視点と対比させると理解が速い
- 決定した設計には、前提条件をコメントで残す(前提が変わったら設計が変わる箇所を明示)

## 技術スタック

- DB: PostgreSQL 18(Docker Compose、ローカル)
  - 選定理由: 現時点の最新安定版(19はBeta)。本番先が未定で制約がなく、EOLが最も長い。学習プロジェクトで古いメジャーを選ぶ積極的理由がない
- API: **Go + pgx + sqlc**。SQLは自分で書き、sqlcで型付き関数を生成(ORM任せにしない)
- データ生成: TypeScript + @faker-js/faker(jaロケール)で CSV 生成 → `psql \copy` で投入
  - **INSERTループ禁止**(100万件で時間単位かかる)。IDは生成側で採番(1〜N)し、FK整合も生成側で取る
- フロント: React Native + Expo(EAS)。Expo Router / TanStack Query + zustand。
  画面は5本(一覧・詳細・カート[ローカル状態のみ]・注文確定・履歴)
  - コンポーネント規約: `components/<name>/<name>.tsx` のディレクトリ単位で作る
    (`<name>.web.tsx` などプラットフォーム分岐ファイルを同居させる余地のため)
- CI/CD: GitHub Actions + Renovate(依存更新。設定は renovate.json5、判断は ADR 007)
- AIエージェント: 公式マーケットプレイス(`claude-plugins-official`)のプラグインを
  `.claude/settings.json` の `enabledPlugins` で有効化。リポジトリにチェックイン済みなので
  ローカル・Web どちらのセッションでも自動ロードされる
  - `expo`: Expo公式スキル([expo/skills](https://github.com/expo/skills))
  - `feature-dev`: `/feature-dev` で機能追加を7フェーズ(探索→要件→設計→実装→レビュー)で進める
    ワークフロー。code-explorer / code-architect / code-reviewer の3エージェント付き。
    「選択肢→トレードオフ→推奨案」を出す設計フェーズが本プロジェクトの進め方と相性がよい
- ツール・タスク管理: **mise**(`mise.toml`)— Node/Goのバージョン固定、PG*環境変数、タスクランナー(`mise run up` など)を1ファイルに集約。操作の入口はすべて mise タスクにする

## フェーズ構成

- **フェーズA**: Docker + スキーマ適用 + fakerでデータ生成 + 100万件クエリの実測(SQLとTSスクリプトで完結。Goは持ち込まない)
- **フェーズB**: API設計・実装(Go)。POST /orders の設計は確定済み(下記)
- **フェーズC**: React Native + Expo で5画面のアプリを公開ポートフォリオ品質で構築(エラー系UXがAPI設計の実演)
- **フェーズD**: CI/CD(GitHub Actions — lint / test / マイグレーション検証)+ Renovate(依存更新)

## 公開リポジトリ・ドキュメント方針

**このリポジトリは公開する。設計判断はドキュメントとして残す。**

- 設計判断は「何を選んだか」だけでなく「選択肢・トレードオフ・なぜそうしたか」を残す(このCLAUDE.mdの判断表がその実例)
- 大きな判断は `docs/decisions/` にADR(Architecture Decision Record)形式で追加していく
- コード内コメントには前提条件を残す(前提が変わったら設計が変わる箇所を明示)
- READMEは学習プロジェクトであることと各フェーズの学びを外部の読者に伝わる形で書く

## データモデル(確定済み・8テーブル)

users, user_addresses, categories, products, orders, order_items, payments, reviews

詳細は `schema.sql` を参照。カートはあえて作らない(未確定の作業中データで性質が違う。必要になったら議論)。

### モデリングの3原理(このプロジェクトの判断基準)

1. **イベントとリソースを分ける** — orders/order_items/payments/reviews は「起きたコト」、users/products は「存在するモノ」。イベントは原則UPDATEしない
2. **属性は「何に対して1つ決まるか」で置き場所が決まる** — 迷ったら隠れたエンティティを疑う(例: 配送料は「配送」に対して1つ → 分割配送があるならshipmentsが必要)
3. **イベントはスナップショットを持つ** — リソースの変更に過去の事実が影響されない(order_items.unit_price_jpy, orders.ship_to_*)

### 確定した設計判断と根拠

| 判断 | 根拠 |
|---|---|
| 金額は整数(JPY) | 日本円なので小数不要 |
| orders.total_jpy を非正規化 | 実務の定番。order_itemsのSUMとの整合性検証クエリ自体が練習になる |
| 1注文=1配送 | v1のスコープ制限。分割配送はv2でshipmentsテーブルに分離 |
| 配送先は user_addresses(住所帳)+ ordersへカラムコピー | スナップショット原理。イミュータブルFK方式は「規律で守る」ため不採用 — **仕組みで安全 > 規律で安全** |
| payments を分離 | 注文と1:N(決済試行ごとに1行、失敗も記録)。返金はマイナス金額行(SUMで実収額) |
| インデックスはPK/UNIQUE以外まだ張らない | **意図的**。遅さをEXPLAIN ANALYZEで実測してから張るのが学習の核。勝手に張らないこと |

## API設計の3原則(POST /orders で確立済み)

1. **金額はサーバーが決定する** — クライアントはproduct_idとquantityだけ送る。expected_total_jpyは価格改定検知(UX保護)のためで、不一致なら409
2. **チェックと更新はアトミックに** — 在庫引き当ては `UPDATE products SET stock = stock - $qty WHERE id = $id AND stock >= $qty` で行ロックに任せる。SELECT→UPDATE分離はTOCTOUレースで在庫マイナス事故になる
3. **リトライは冪等キーで吸収** — `Idempotency-Key` ヘッダ + orders.idempotency_key のUNIQUE制約。重複チェックはSELECT先行ではなくINSERT先行でUNIQUE違反を捕まえる(これもTOCTOU回避)

注文トランザクションの境界は「全部成功か全部失敗か」(業務ルール由来)。

## 想定データ量

| テーブル | 件数 |
|---|---|
| users | 100,000 |
| categories | 50 |
| products | 50,000 |
| orders | 300,000 |
| order_items | **1,200,000** |
| reviews | 200,000 |

## フェーズAは完了(2026-08-21)

実測記録は `docs/measurements/`、設計判断は `docs/decisions/`(ADR 001〜006)を参照。
学習の総括は README のハイライト表。

## フェーズBは完了(2026-08-21)

POST /orders(Tx+冪等+並行実証)、GET /orders(カーソル)、GET /products ×2、GET /categories。
エラー→HTTP対応表・層深度ルールは `api/internal/handler/` のコメント参照。

## フェーズCは完了(2026-08-22)

5画面 + Liquid Glass(NativeTabs)+ エラー系UX(409/冪等リトライをシミュレータで実証)+
mobile/README.md(スクリーンショット・GIF)。設計判断はコード内の前提コメントに残置。

## Apple Watch 対応(2026-08-28・閲覧のみ)

RN は watchOS で動かないため、Watch は SwiftUI ネイティブ実装(`mobile/targets/watch/`)。
`@bacons/apple-targets` で prebuild 時に Xcode ターゲットとして注入し CNG を維持。
データは Watch から API を直接取得(一覧は先頭1ページのみ)。判断の詳細は ADR 008。

## Web 対応(2026-09-04・PR #5)

同じ RN コードベースを react-native-web で動かす。ヘッダーナビ(`site-header.web.tsx`)・
ヘッドレスタブ(`(tabs)/_layout.web.tsx`)・`Alert` 代替のダイアログ(`app-dialog/*.web.*`)・
グリッド列数(`use-grid-columns.web.ts`)を `.web.tsx` 同居分岐で吸収。ブレークポイントは
md=768 / lg=1024 の2段のみ(`src/theme/breakpoints.ts`)。
**Go API に CORS が未実装**なので、ブラウザからの実 API 接続は宿題(`src/api/client.ts` のコメント参照)。
スクリーンショットは mobile/README.md の Web 節。

## フェーズDは完了(2026-08-28)

- CI(PR #1): lint / test / マイグレーション検証を mise タスク経由で実行。migrate.sh は CI でもそのまま使う
  (gomigrate 置き換えは不要と判断 — 自作30行で CI 要件を満たした)
- ネイティブビルド検証(2026-09-04): mobile/ ・mise.toml・ci.yml が変わった PR / main push で
  `mise run mobile-ios-build`(macos-26・シミュレータ・署名なし・SKIP_BUNDLING)と
  `mise run mobile-android-build`(ubuntu・assembleDebug・x86_64 のみ)を回す。判定は dorny/paths-filter。
  GitHub-hosted を選んだ理由(EAS でなく)・キャッシュを後回しにした理由は ci.yml のコメントに残置。
  `workflow_dispatch` で任意ブランチから手動実行できる
- Renovate(ADR 007): hosted App + `renovate.json5`(コメント付き)。運用ルール:
  - major は Dependency Dashboard でチェックを入れてから PR が作られる(承認制)
  - Expo SDK 連動パッケージは patch のみ・1グループ(`renovate/expo-sdk`)。そのブランチだけ CI で
    `expo install --check` が走る。exact ピン(RN / react / reanimated …)は Renovate の対象外なので、
    その期待が動くとこの PR が赤くなる → `npx expo install --fix` を足してからマージ。SDK ラインの移動も同じコマンドで手動
  - sqlc の更新 PR は CI の乖離チェックで赤くなる前提 → `mise run sqlc` の再生成コミットを足す
  - postgres の major は止めている(ADR 001 を書き直してから手で)
  - 設定を変えたら `mise run renovate-dry-run`(Node 24 を一時使用。PR は作らない)で提案内容を先に見る

## フェーズCの記録(参考)

構成の決定済み事項: pnpm(mise固定)/ タブ+スタック / モック→実APIは `src/api/client.ts` の中身だけ差し替え / 商品画像は picsum.photos(seed=product_id)/ アクセントは systemBlue(ライト・ダーク両対応)。

1. C-0: scaffold + mise タスク + 規約(components/<name>/<name>.tsx)
2. C-1: デザイントークン(src/theme)+ 基礎コンポーネント
3. C-2: 5画面をモックで構築、agent-device でシミュレータ検証
4. C-3: 実API接続(useInfiniteQuery × next_cursor、ApiError 契約)
5. C-3.4: **development build 化** — Expo Go をやめ expo-dev-client + prebuild +
   expo run:ios に移行(Expo Go の開発UIオーバーレイ排除・ネイティブ依存の自由度・
   agent-device での検証安定化。スクリーンショットが本番同等の見た目になる)
6. C-3.5: **デザインブラッシュアップ** — expo-native-ui / expo-design-system の audit /
   frontend-design skill を使い、agent-device のスクリーンショット→評価→修正ループで
   ポートフォリオ品質に磨く(実データの文字量で崩れる箇所もここで直す)
7. C-4: エラー系UX — 409 価格改定ダイアログ・Idempotency-Key リトライ・在庫切れ(見せ場)
8. C-5: mobile README + スクリーンショット/GIF