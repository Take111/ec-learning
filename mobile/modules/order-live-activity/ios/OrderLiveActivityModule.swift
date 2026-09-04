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
            (orderId: Int, totalJpy: Int, itemCount: Int, startedAtMs: Double, stageCount: Int,
             status: String, stageIndex: Int, stageStartedAtMs: Double, stageEndsAtMs: Double?) -> Bool in
            guard ActivityAuthorizationInfo().areActivitiesEnabled else { return false }
            let content = makeContent(status: status, stageIndex: stageIndex,
                                      stageStartedAtMs: stageStartedAtMs, stageEndsAtMs: stageEndsAtMs)
            if let existing = findActivity(orderId: orderId) {
                await existing.update(content)
                return true
            }
            let attributes = OrderActivityAttributes(
                orderId: orderId, totalJpy: totalJpy, itemCount: itemCount,
                startedAt: dateFromMs(startedAtMs), stageCount: stageCount)
            _ = try Activity.request(attributes: attributes, content: content)
            return true
        }

        AsyncFunction("update") {
            (orderId: Int, status: String, stageIndex: Int, stageStartedAtMs: Double, stageEndsAtMs: Double?) in
            guard let activity = findActivity(orderId: orderId) else { return }
            await activity.update(makeContent(status: status, stageIndex: stageIndex,
                                              stageStartedAtMs: stageStartedAtMs, stageEndsAtMs: stageEndsAtMs))
        }

        // 終端状態を表示したまま dismissAtMs まで残す。nil なら即時に消す(期限切れの残骸の掃除用)。
        // ActivityKit は .after を「今から最大4時間」に丸めるので、JS 側の1時間指定はそのまま通る
        AsyncFunction("end") {
            (orderId: Int, status: String, stageIndex: Int, stageStartedAtMs: Double, dismissAtMs: Double?) in
            guard let activity = findActivity(orderId: orderId) else { return }
            let content = makeContent(status: status, stageIndex: stageIndex,
                                      stageStartedAtMs: stageStartedAtMs, stageEndsAtMs: nil)
            let policy: ActivityUIDismissalPolicy = dismissAtMs.map { .after(dateFromMs($0)) } ?? .immediate
            await activity.end(content, dismissalPolicy: policy)
        }

        // 進行中の Activity 一覧(終了済みは含まれない)。アプリ再起動時に JS 側の追跡表を復元するために使う
        AsyncFunction("list") { () -> [[String: Any]] in
            Activity<OrderActivityAttributes>.activities.map { activity in
                [
                    "orderId": activity.attributes.orderId,
                    "startedAtMs": activity.attributes.startedAt.timeIntervalSince1970 * 1000,
                    "status": activity.content.state.status,
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
private func makeContent(status: String, stageIndex: Int, stageStartedAtMs: Double, stageEndsAtMs: Double?)
    -> ActivityContent<OrderActivityAttributes.ContentState> {
    let stageEndsAt = stageEndsAtMs.map(dateFromMs)
    let state = OrderActivityAttributes.ContentState(
        status: status,
        stageIndex: stageIndex,
        stageStartedAt: dateFromMs(stageStartedAtMs),
        stageEndsAt: stageEndsAt
    )
    return ActivityContent(state: state, staleDate: stageEndsAt)
}

// JS の Date.now()(エポックms)をそのまま受ける。Date 型の自動変換に頼らず契約を数値に固定する
private func dateFromMs(_ ms: Double) -> Date {
    Date(timeIntervalSince1970: ms / 1000)
}
