import ActivityKit
import ExpoModulesCore

// JS(src/live-activity/order-live-activity.ts)から ActivityKit を操作する薄い橋。
// 前提: 状態遷移の判断は JS 側。ここは「注文 id で Activity を探して request / update / end する」だけで、
//   タイマーも業務ルールも持たない(Watch の ApiClient と同じ「最小の橋」方針)
// 前提: 本体アプリの deployment target は 16.4(Expo SDK 57 の Podfile 既定)で ActivityKit の下限を満たすため
//   #available ガードは置いていない。15 系へ下げるなら #available(iOS 16.2, *) と podspec の weak_frameworks が要る
public class OrderLiveActivityModule: Module {
    public func definition() -> ModuleDefinition {
        Name("OrderLiveActivity")

        // 戻り値: 表示できたか。ユーザーが設定で Live Activity を切っていると false(JS 側はタイマーを張らない)。
        // 同じ注文の Activity が既にあれば作り直さず update に倒す(POST /orders の冪等リプレイで二重表示しない)
        AsyncFunction("start") {
            (orderId: Int, totalJpy: Int, itemCount: Int, status: String, stageStartedAtMs: Double, stageEndsAtMs: Double?) -> Bool in
            guard ActivityAuthorizationInfo().areActivitiesEnabled else { return false }
            let content = makeContent(status: status, stageStartedAtMs: stageStartedAtMs, stageEndsAtMs: stageEndsAtMs)
            if let existing = findActivity(orderId: orderId) {
                await existing.update(content)
                return true
            }
            let attributes = OrderActivityAttributes(orderId: orderId, totalJpy: totalJpy, itemCount: itemCount)
            _ = try Activity.request(attributes: attributes, content: content)
            return true
        }

        AsyncFunction("update") { (orderId: Int, status: String, stageStartedAtMs: Double, stageEndsAtMs: Double?) in
            guard let activity = findActivity(orderId: orderId) else { return }
            await activity.update(makeContent(status: status, stageStartedAtMs: stageStartedAtMs, stageEndsAtMs: stageEndsAtMs))
        }

        // 終端状態(delivered など)を表示したまま dismissAtMs まで残す。nil なら OS 既定(しばらく残して自動で消える)。
        // ActivityKit は .after を「今から最大4時間」に丸めるので、JS 側の1時間指定はそのまま通る
        AsyncFunction("end") { (orderId: Int, status: String, dismissAtMs: Double?) in
            guard let activity = findActivity(orderId: orderId) else { return }
            var state = activity.content.state
            state.status = status
            state.stageEndsAt = nil
            let policy: ActivityUIDismissalPolicy = dismissAtMs.map { .after(dateFromMs($0)) } ?? .default
            await activity.end(ActivityContent(state: state, staleDate: nil), dismissalPolicy: policy)
        }

        // 進行中の Activity 一覧(終了済みは含まれない)。アプリ再起動時に JS 側の追跡表を復元するために使う。
        // 開始時刻そのものは持たないので、JS 側が status と stageStartedAt から逆算する
        Function("list") { () -> [[String: Any]] in
            Activity<OrderActivityAttributes>.activities.map { activity in
                [
                    "orderId": activity.attributes.orderId,
                    "status": activity.content.state.status,
                    "stageStartedAtMs": activity.content.state.stageStartedAt.timeIntervalSince1970 * 1000,
                ]
            }
        }

        // 追跡していないものも含めて全部消す(履歴タブを開いたとき)
        AsyncFunction("endAll") { () in
            for activity in Activity<OrderActivityAttributes>.activities {
                await activity.end(nil, dismissalPolicy: .immediate)
            }
        }
    }
}

private func findActivity(orderId: Int) -> Activity<OrderActivityAttributes>? {
    Activity<OrderActivityAttributes>.activities.first { $0.attributes.orderId == orderId }
}

// staleDate = 現ステージの終了予定。アプリがサスペンド中で次ステージへ進められなかったとき、
// OS が isStale=true で再描画するので、ウィジェット側が「アプリを開くと更新」に言い換えられる
private func makeContent(status: String, stageStartedAtMs: Double, stageEndsAtMs: Double?) -> ActivityContent<OrderActivityAttributes.ContentState> {
    let stageEndsAt = stageEndsAtMs.map(dateFromMs)
    let state = OrderActivityAttributes.ContentState(
        status: status,
        stageStartedAt: dateFromMs(stageStartedAtMs),
        stageEndsAt: stageEndsAt
    )
    return ActivityContent(state: state, staleDate: stageEndsAt)
}

// JS の Date.now()(エポックms)をそのまま受ける。Date 型の自動変換に頼らず契約を数値に固定する
private func dateFromMs(_ ms: Double) -> Date {
    Date(timeIntervalSince1970: ms / 1000)
}
