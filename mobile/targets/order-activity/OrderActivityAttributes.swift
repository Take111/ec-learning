import ActivityKit
import Foundation

// Live Activity の型定義。本体アプリ(modules/order-live-activity の Expo Module)と
// ウィジェット拡張(このターゲット)の両方でコンパイルされる共有型。
// 前提: ActivityKit は attributes を型名で突き合わせるため、両ターゲットに同じ定義が必要。
//   実体はこのファイル1つで、Expo Module 側は podspec の source_files から相対パスで参照する
//   (ファイルを複製して「同期を規律で守る」方式は採らない — 仕組みで安全 > 規律で安全)
struct OrderActivityAttributes: ActivityAttributes {
    struct ContentState: Codable, Hashable {
        // mobile/src/api/types.ts の OrderStatus と同じ文字列(pending / paid / shipped / delivered / cancelled)。
        // enum にしないのは、JS 側の語彙が増えてもデコードで落ちないようにするため
        var status: String
        // 現ステージの開始時刻と終了予定。終了予定が nil なら終端(delivered)。
        // Text(timerInterval:) は OS がこの区間を使って自走させるので、アプリが停止していても
        // カウントダウンだけは動き続ける(進捗トラックと状態の切り替えはアプリ側の update 待ち)
        var stageStartedAt: Date
        var stageEndsAt: Date?
    }

    // 注文確定時に決まり、以後変わらない値(POST /orders の応答 + 確定時点のカート点数)
    let orderId: Int
    let totalJpy: Int
    let itemCount: Int
}
