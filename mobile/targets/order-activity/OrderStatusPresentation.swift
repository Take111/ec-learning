import SwiftUI

// status 文字列 → 表示ラベル・色・SF Symbol。mobile/src/utils/order-status.ts の Swift 版。
// 前提: ラベルと色相は RN 側と同じ対応(pending=補助色 / paid=アクセント / shipped=teal /
//   delivered=green / cancelled=red)。RN 側を変えたらここも連動して変える
struct OrderStatusPresentation {
    let label: String
    let color: Color
    let symbol: String
    // 進捗トラック(4段)での位置。進行系でない状態(cancelled / 未知)は nil
    let stageIndex: Int?
    // そのステージの間に「何が進んでいるか」。終端(delivered)は nil
    let inProgressLabel: String?

    static let stageCount = 4

    init(status: String) {
        switch status {
        case "pending":
            label = "支払い待ち"; color = .secondary; symbol = "clock.fill"
            stageIndex = 0; inProgressLabel = "支払いを確認しています"
        case "paid":
            label = "支払い済み"; color = .accentColor; symbol = "creditcard.fill"
            stageIndex = 1; inProgressLabel = "発送の準備をしています"
        case "shipped":
            label = "発送済み"; color = .teal; symbol = "shippingbox.fill"
            stageIndex = 2; inProgressLabel = "配達中です"
        case "delivered":
            label = "配達完了"; color = .green; symbol = "checkmark.circle.fill"
            stageIndex = 3; inProgressLabel = nil
        case "cancelled":
            label = "キャンセル"; color = .red; symbol = "xmark.circle.fill"
            stageIndex = nil; inProgressLabel = nil
        default:
            label = status; color = .secondary; symbol = "questionmark.circle"
            stageIndex = nil; inProgressLabel = nil
        }
    }
}

// 金額表示は RN 側 formatPrice(Intl.NumberFormat ja-JP / JPY)と同じ見た目(¥12,345)
func formatJpy(_ amount: Int) -> String {
    amount.formatted(.currency(code: "JPY").locale(Locale(identifier: "ja_JP")))
}
