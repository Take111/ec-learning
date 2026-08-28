import SwiftUI

// Watch アプリのエントリポイント。WatchKit Extension を分離しない単一ターゲット構成
// (SwiftUI ライフサイクル)。動作下限は deploymentTarget の watchOS 9.4
// (NavigationStack / AsyncImage / URL.appending(path:) が必要とする watchOS 9 以上)
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
