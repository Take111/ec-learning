# ADR 007: Apple Watch 対応は SwiftUI ネイティブ + API 直接取得(閲覧のみ)

- ステータス: 採用
- 日付: 2026-08-28

## 背景

フェーズC完了後、Apple Watch で商品を閲覧したいという要望が出た。スコープは
「一覧と詳細の閲覧のみ」(カート・注文は対象外)。

前提となる制約: **React Native(JS ランタイム)は watchOS では動かない**。
これは Expo の制限ではなく RN 自体の制限で、Expo 公式ドキュメントにも watchOS 向け
ガイドは存在しない(Expo Modules の追加プラットフォームも macOS / tvOS まで)。
つまり Watch 側の UI は何を選んでもネイティブ(SwiftUI)実装になり、
論点は「iOS アプリとの同居方法」と「データの取得経路」の2つ。

## 選択肢とトレードオフ

### 1. Xcode ターゲットの同居方法

| 選択肢 | 利点 | 欠点 |
|---|---|---|
| `@bacons/apple-targets`(採用) | `targets/watch/` に閉じ込めたまま prebuild ごとに自動注入。CNG(`prebuild --clean`)が維持される | 非公式(Expo コアチームの Evan Bacon 氏製)。watch タイプは "テストしていない" と README に明記 |
| Xcode で手動追加 | 仕組みが一番よく見える | `prebuild --clean` のたびに消える。「規律で守る」方式になり、本プロジェクトの「仕組みで安全 > 規律で安全」に反する |

### 2. データの取得経路

| 選択肢 | 利点 | 欠点 |
|---|---|---|
| Watch から API を直接取得(採用) | 構成が最小。閲覧のみ(GET 2本)と相性がよい。watchOS は単独でネットワークに出られる | iPhone 側とキャッシュ・認証状態を共有できない |
| WatchConnectivity / App Groups で iPhone から中継 | オフライン時や認証状態の共有に強い | 中継コードの分だけ複雑。閲覧のみの現段階では過剰 |

## 決定

- `@bacons/apple-targets` の `watch` ターゲットで SwiftUI ネイティブ実装(`mobile/targets/watch/`)
- データは Watch から Go API を直接取得(`GET /products`, `GET /products/:id`)
- 一覧は**先頭1ページ(20件)のみ**。RN 側のカーソル無限スクロールは持ち込まない
  (Watch は glanceable な端末。全件を眺めるユースケースは iPhone 側の役割)
- JSON 契約は `mobile/src/api/types.ts` と 1:1 の Swift 構造体
  (snake_case はデコーダの `.convertFromSnakeCase` で吸収)

## 根拠

- 同居方法: CNG を壊さないことを最優先した。手動追加は「規律で守る」方式であり、
  ADR 002 以来の「仕組みで安全 > 規律で安全」と一貫しない
- 取得経路: 閲覧のみのスコープでは中継の複雑さに見合う利点がない。
  認証やオフライン対応が要件に入った時点で WatchConnectivity を再検討する
  (この ADR の前提が変わる箇所)
- 冪等キー・ApiError 契約(RN 側 client.ts)は持ち込まない。これらは書き込み系の
  ための道具であり、Watch に書き込みを足すならその時に RN 側と同じ形で移植する

## 制約・残課題

- `@bacons/apple-targets` の watch タイプは実験的。壊れたら手動追加方式へ退避できる
  よう、Watch 関連コードは `targets/watch/` に完結させてある
- 実機ビルドには `app.json` の `ios.appleTeamId` の設定が必要(シミュレータは不要)
- API が `http://localhost` 平文のため、Watch 側 `Info.plist` に ATS 例外
  (`NSAllowsLocalNetworking`)を置いた。本番 API を https にする際に削除する
