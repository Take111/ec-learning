import SwiftUI

// 画面共通の取得状態(loading / loaded / failed)。
// 前提: 一覧・詳細とも「1リクエスト=1画面」の構成なので、状態機械はこの3状態で足りる。
//   キャッシュや stale 表示が要件になったら、ここに状態を足すのではなく
//   ストア層の導入から議論し直す(ADR 008 の最小スコープが前提)
enum LoadPhase<Value> {
    case loading
    case loaded(Value)
    case failed
}

// loading / failed の共通UI。loaded の中身だけを画面ごとに差し替える
struct PhaseView<Value, Content: View>: View {
    let phase: LoadPhase<Value>
    let retry: () -> Void
    @ViewBuilder let content: (Value) -> Content

    var body: some View {
        switch phase {
        case .loading:
            ProgressView()
        case .failed:
            VStack(spacing: 8) {
                Text("読み込みに失敗しました")
                    .font(.footnote)
                Button("再試行", action: retry)
            }
        case .loaded(let value):
            content(value)
        }
    }
}
