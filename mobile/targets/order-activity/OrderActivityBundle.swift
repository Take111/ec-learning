import SwiftUI
import WidgetKit

// ウィジェット拡張のエントリポイント。Live Activity のみ(ホーム画面ウィジェットは持たない)
@main
struct OrderActivityBundle: WidgetBundle {
    var body: some Widget {
        OrderActivityWidget()
    }
}
