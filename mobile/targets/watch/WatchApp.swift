import SwiftUI

// Watch アプリのエントリポイント。watchOS 7+ の単一ターゲット構成
// (WatchKit Extension 分離のない SwiftUI ライフサイクル)
@main
struct WatchApp: App {
    var body: some Scene {
        WindowGroup {
            NavigationStack {
                ProductListView()
            }
        }
    }
}
