import SwiftUI

// status 文字列 → 表示ラベル・色・SF Symbol。mobile/src/utils/order-status.ts の Swift 版。
// 前提: ラベルと色相は RN 側と同じ対応(pending=補助色 / paid=アクセント / shipped=teal /
//   delivered=green / cancelled=red)。RN 側を変えたらここも連動して変える。
//   ステージの順序・段数はここに持たない(ContentState の stageIndex / Attributes の stageCount で JS 側から届く)
struct OrderStatusPresentation {
    let label: String
    let color: Color
    let symbol: String
    // そのステージの間に「何が進んでいるか」。終端(delivered)は nil
    let inProgressLabel: String?

    init(status: String) {
        switch status {
        case "pending":
            label = "支払い待ち"; color = .secondary; symbol = "clock.fill"
            inProgressLabel = "支払いを確認しています"
        case "paid":
            label = "支払い済み"; color = .accentColor; symbol = "creditcard.fill"
            inProgressLabel = "発送の準備をしています"
        case "shipped":
            label = "発送済み"; color = .teal; symbol = "shippingbox.fill"
            inProgressLabel = "配達中です"
        case "delivered":
            label = "配達完了"; color = .green; symbol = "checkmark.circle.fill"
            inProgressLabel = nil
        case "cancelled":
            label = "キャンセル"; color = .red; symbol = "xmark.circle.fill"
            inProgressLabel = nil
        default:
            label = status; color = .secondary; symbol = "questionmark.circle"
            inProgressLabel = nil
        }
    }
}

// 金額表示は RN 側 formatPrice(Intl.NumberFormat ja-JP / JPY)と同じ見た目(¥12,345)。
// 書式は描画のたびに作らず1つを使い回す(合計は Activity の寿命中に変わらない)
private let jpyStyle = IntegerFormatStyle<Int>.Currency(code: "JPY", locale: Locale(identifier: "ja_JP"))

func formatJpy(_ amount: Int) -> String {
    amount.formatted(jpyStyle)
}
