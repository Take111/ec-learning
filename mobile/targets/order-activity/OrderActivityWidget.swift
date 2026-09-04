import ActivityKit
import SwiftUI
import WidgetKit

// 注文の Live Activity(ロック画面バナー + Dynamic Island)。
// 前提: 状態遷移はアプリ側(src/live-activity/order-live-activity.ts)が update() で押し込む。
//   ここは ContentState の純関数で、ネットワークもタイマーも持たない。
//   OS 側で自走するのは timerInterval 系の表示(カウントダウン・進捗バー)だけ
// 前提: タップ先は履歴タブ(eclearning://orders)。scheme は app.json、/orders は src/app/(tabs)/orders。
//   履歴を開いた時点でアプリ側が Activity を終了する(useFocusEffect)
private let ordersDeepLink = URL(string: "eclearning://orders")

struct OrderActivityWidget: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: OrderActivityAttributes.self) { context in
            LockScreenView(attributes: context.attributes, state: context.state, isStale: context.isStale)
                .widgetURL(ordersDeepLink)
        } dynamicIsland: { context in
            let presentation = OrderStatusPresentation(status: context.state.status)
            return DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    // 展開時の leading は幅が狭いので「#番号」に短縮し、収まらなければ縮小して1行に保つ
                    // (6桁の注文番号でも折り返さない — 実測で "#45020 / 6" に割れた)
                    Label("#\(String(context.attributes.orderId))", systemImage: presentation.symbol)
                        .font(.headline)
                        .lineLimit(1)
                        .minimumScaleFactor(0.6)
                        .foregroundStyle(presentation.color)
                        .padding(.leading, 4)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    Text(formatJpy(context.attributes.totalJpy))
                        .font(.headline)
                        .monospacedDigit()
                        .padding(.trailing, 4)
                }
                DynamicIslandExpandedRegion(.bottom) {
                    StageProgressView(state: context.state, presentation: presentation, isStale: context.isStale)
                        .padding(.horizontal, 4)
                }
            } compactLeading: {
                Image(systemName: presentation.symbol)
                    .foregroundStyle(presentation.color)
            } compactTrailing: {
                Text(formatJpy(context.attributes.totalJpy))
                    .font(.caption)
                    .monospacedDigit()
            } minimal: {
                Image(systemName: presentation.symbol)
                    .foregroundStyle(presentation.color)
            }
            .widgetURL(ordersDeepLink)
            .keylineTint(presentation.color)
        }
    }
}

// ロック画面・通知センター・StandBy に出るバナー
private struct LockScreenView: View {
    let attributes: OrderActivityAttributes
    let state: OrderActivityAttributes.ContentState
    let isStale: Bool

    var body: some View {
        let presentation = OrderStatusPresentation(status: state.status)
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .firstTextBaseline) {
                // 前提: Text / Label の文字列補間は LocalizedStringKey 扱いで Int に桁区切りが入る
                //   (450205 → 450,205)。注文番号は識別子なので String() で素通しにする
                Label("注文番号 \(String(attributes.orderId))", systemImage: "shippingbox.fill")
                    .font(.headline)
                Spacer()
                Text(formatJpy(attributes.totalJpy))
                    .font(.title3.weight(.semibold))
                    .monospacedDigit()
            }
            HStack(spacing: 8) {
                StatusPill(presentation: presentation)
                Text("\(attributes.itemCount)点")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
            StageProgressView(state: state, presentation: presentation, isStale: isStale)
        }
        .padding()
    }
}

private struct StatusPill: View {
    let presentation: OrderStatusPresentation

    var body: some View {
        Label(presentation.label, systemImage: presentation.symbol)
            .font(.subheadline.weight(.medium))
            .foregroundStyle(presentation.color)
            .padding(.horizontal, 10)
            .padding(.vertical, 4)
            .background(presentation.color.opacity(0.15), in: Capsule())
    }
}

// 4段の進捗トラック + 現ステージのカウントダウン(OS が自走)。
// 終端(stageEndsAt == nil)では「何が進んでいるか」の行を出さず、トラックを全点灯にする。
// 前提: 状態を進めるのはアプリ側なので、アプリがサスペンド中にカウントダウンが尽きると次へ進めない。
//   その状態は staleDate(= stageEndsAt)経過で OS が isStale=true にして再描画してくれるので、
//   「0:00」で止まった表示を「アプリを開くと更新」に言い換える(ADR 009 の制約をUIで正直に出す)
private struct StageProgressView: View {
    let state: OrderActivityAttributes.ContentState
    let presentation: OrderStatusPresentation
    let isStale: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 4) {
                ForEach(0..<OrderStatusPresentation.stageCount, id: \.self) { index in
                    Capsule()
                        .fill(isReached(index) ? presentation.color : Color.secondary.opacity(0.25))
                        .frame(height: 4)
                }
            }
            if let inProgress = presentation.inProgressLabel, let endsAt = state.stageEndsAt {
                HStack {
                    if isStale {
                        Text("アプリを開くと最新の状態に更新されます")
                    } else {
                        Text(inProgress)
                        Spacer()
                        // 区間の下限が上限を超えると ClosedRange が落ちるので min で防御(JS 側は常に start <= end を保証)
                        Text(timerInterval: min(state.stageStartedAt, endsAt)...endsAt, countsDown: true)
                            .monospacedDigit()
                    }
                }
                .font(.caption)
                .foregroundStyle(.secondary)
            }
        }
    }

    private func isReached(_ index: Int) -> Bool {
        guard let current = presentation.stageIndex else { return false }
        return index <= current
    }
}
