# ADR 009: 注文の Live Activity は SwiftUI ウィジェット拡張 + ローカル Expo Module(進捗はクライアント側の疑似)

- ステータス: 採用
- 日付: 2026-09-04

## 背景

注文確定(`POST /orders` 成功)の直後に、iOS の Live Activity(ロック画面バナー + Dynamic Island)で
注文状況を出したい。RN の見せ場を増やすポートフォリオ目的で、ADR 008(Watch)に続く
「RN の外側をどう同居させるか」の2件目にあたる。

前提となる制約が2つある。

1. **Live Activity の UI は WidgetKit 拡張の SwiftUI でしか描けない**(RN/JS は動かない)。
   本体からの開始・更新・終了は ActivityKit を Swift で呼ぶ必要があり、JS との橋が要る
2. **サーバーに注文の進捗が存在しない**。`orders.status` は常に `pending` で作られ、更新する
   コードは API のどこにもない(「イベントは UPDATE しない」原則 — CLAUDE.md)。
   つまり Live Activity を時間経過で更新する材料が、今のバックエンドには無い

## 選択肢とトレードオフ

### 1. 実装方式

| 選択肢 | 利点 | 欠点 |
|---|---|---|
| `expo-widgets`(SDK 57 同梱の公式パッケージ。UI を JSX で書く) | 手数が最小。Expo が CNG でターゲットを生成 | 公式ブログは alpha 表記。`Text(timerInterval:)` 相当が無くロック中は何も動かない。`@bacons/apple-targets` と同じ pbxproj を2つのプラグインが触る同居が未検証 |
| `@bacons/apple-targets` の `widget` + SwiftUI + ローカル Expo Module(採用) | Watch(ADR 008)と同じ `targets/` 流儀で CNG も CI も既存の仕組みに乗る。SwiftUI 全部が使え、`Text(timerInterval:)` でロック中もカウントダウンが動く。ActivityKit と Expo Modules API を直接学べる | コード量が多い(Swift 4本 + Module + TS)。`ActivityAttributes` を本体側とウィジェット側の両方でコンパイルする工夫が要る |

### 2. 進捗の表現(サーバーに進捗が無い前提で)

| 選択肢 | 利点 | 欠点 |
|---|---|---|
| 受付の1状態のみ表示 | バックエンドの事実に忠実 | 動きが無く Live Activity の意味が薄い |
| クライアント側の疑似進捗(採用) | デモとして進行が見える。API を変えない | 「偽の状態遷移」であることを明示する必要がある(この ADR とコード内コメント) |
| API に状態遷移を追加して refetch で更新 | バックエンド学習になる | スコープ拡大。「イベントは UPDATE しない」原則との折り合いが要る |

### 3. `ActivityAttributes` の共有方法(本体 Pod とウィジェット拡張は別の Swift モジュール)

| 選択肢 | 判定 |
|---|---|
| 両ターゲットにファイルを複製 | 同期を「規律で守る」方式なので不採用(ADR 002 以来の方針) |
| podspec の `source_files` に `../../../targets/...` を書く | CocoaPods が Pod ルート外のパスを黙って無視する(prebuild で実測)。不採用 |
| `targets/order-activity/` の実体へのシンボリックリンクを Module 側に置く(採用) | 実体は1ファイル。リンクを消せばビルドが落ちるので気づける |

## 決定

- `mobile/targets/order-activity/`(`@bacons/apple-targets` の `widget` ターゲット)に SwiftUI で
  ロック画面バナーと Dynamic Island(compact / minimal / expanded)を実装
- `mobile/modules/order-live-activity/`(ローカル Expo Module)が `start / update / end / endAll` を JS に公開。
  Android / web ではモジュール自体がリンクされず、TS 面が no-op になる
- 表示内容: 注文番号・合計(サーバー確定値)・点数(確定時点のカート)・ステータス・4段の進捗トラック
- 進捗は `mobile/src/live-activity/order-activity-stage.ts` の時間割で疑似的に進める
  (pending → +15秒 paid → +45秒 shipped → +90秒 delivered。デモ規模)
- 終了条件は3つ: delivered 到達後は開始から1時間で自動消滅 / 履歴タブを開いたら即終了 /
  アプリ起動時に期限切れ(終端+1時間経過)の残骸を掃除。進行中のものは OS 側の Activity から
  追跡を復元して続行する(強制終了→再起動で進行中の表示を失わないため。レビューで判明し修正)
- 冪等リプレイ(`POST /orders` の 200)による二重開始は、ネイティブ側で同じ `orderId` の
  Activity を探して update に倒すことで防ぐ(client.ts で 200/201 を区別する案より変更範囲が小さい)
- タップ先は履歴タブ(`eclearning://orders`)

## 根拠

- 実装方式: ロック中に何かが動いて見えるかが体験の差を作る。`Text(timerInterval:)` を使える
  SwiftUI 直書きを選び、Watch と同じ流儀で「仕組みで安全 > 規律で安全」を保つ
- 疑似進捗: 学習プロジェクトとして「API を変えずにクライアントで何ができるか」を示す判断。
  偽の遷移であることは、時間割の定数とコメントで明示する
- 共有型: ファイル複製は規律に依存する。シンボリックリンクは git に載り、壊れればビルドで検知できる

## 制約・残課題

- **バックグラウンドで状態は進まない**。JS のタイマーはサスペンドで止まり、ActivityKit にも
  「将来の状態を予約する」API は無い。停止中に状態を進める正道は APNs push(サーバー側ジョブが
  push token へ更新を送る)で、push 基盤の無い本プロジェクトではスコープ外。
  現状は「フォアグラウンド中に更新 + 復帰時に経過時間から再計算して追いつく」方式で、
  ロック中に動くのはウィジェット側のカウントダウン表示だけ
- 履歴タブを開くと即終了するため、注文完了画面の「注文履歴を見る」を押した場合は
  進行を見る前に消える。デモはモーダルを閉じてホームへ戻る(またはロックする)導線で行う
- `OrderActivityAttributes.swift` は本体 Pod とウィジェットで別モジュールとしてコンパイルされる。
  ActivityKit は型名で突き合わせるので動作するが、型を変えるときは両側が同時に更新される
  (同一ファイルなので自動)ことを前提にしている
- ウィジェット拡張の deploymentTarget は本体(Expo SDK 57 の Podfile 既定 16.4)に揃えた。
  本体を 15 系へ下げるなら Module 側に `#available` と podspec の `weak_frameworks` が要る
- 疑似進捗を本物にするなら、API の状態遷移(または push)を足した時点で
  `order-activity-stage.ts` ごと不要になる(この ADR の前提が変わる箇所)
