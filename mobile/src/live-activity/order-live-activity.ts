import { useEffect } from "react";
import { AppState } from "react-native";
import {
  OrderActivityOrder,
  OrderActivityStage,
  OrderLiveActivity,
} from "../../modules/order-live-activity";
import { AUTO_DISMISS_MS, Stage, stageAt, stageOf } from "./order-activity-stage";

// 注文 Live Activity の JS 側コントローラ。開始・疑似進捗の駆動・終了を一手に持つ。
// 前提(バックグラウンド): JS のタイマーはアプリがサスペンドされると止まる。ActivityKit にも
//   「将来の状態を予約する」API は無く、停止中に状態を進める正道は APNs push(サーバー側ジョブ)だけ。
//   push 基盤の無い本プロジェクトでは、
//     1. フォアグラウンド中は setTimeout で次のステージ境界に更新し、
//     2. 復帰時(AppState active)に経過時間から現在ステージを再計算して追いつく
//   方式にしている。ロック中に動くのはウィジェット側の timerInterval 表示だけ(ADR 009)。
// 前提(二重開始): POST /orders の冪等リプレイ(200)は JS からは 201 と区別できないため、
//   同じ orderId の Activity があるかはネイティブ側が照合し、あれば update に倒す
type Tracked = { orderId: number; startedAt: number; status: Stage["status"] };

const tracked = new Map<number, Tracked>();
let nextTick: ReturnType<typeof setTimeout> | undefined;
let resyncing = false;

function toActivityStage(startedAt: number, stage: Stage): OrderActivityStage {
  return {
    status: stage.status,
    stageStartedAtMs: startedAt + stage.startsAtMs,
    stageEndsAtMs: stage.endsAtMs === null ? null : startedAt + stage.endsAtMs,
  };
}

// 注文確定直後に呼ぶ。iOS 以外・Live Activity 無効時は何もしない。
// 失敗(ActivityKit の同時数上限など)は注文処理に影響させない — 表示できなかっただけなので warn に留める
export async function startOrderLiveActivity(order: OrderActivityOrder): Promise<void> {
  if (!OrderLiveActivity.isSupported) return;
  const startedAt = Date.now();
  let started: boolean;
  try {
    started = await OrderLiveActivity.start(order, toActivityStage(startedAt, stageAt(0)));
  } catch (e) {
    console.warn("Live Activity の開始に失敗しました(注文自体は完了しています)", e);
    return;
  }
  if (!started) return;
  tracked.set(order.orderId, { orderId: order.orderId, startedAt, status: "pending" });
  scheduleNextTick();
}

// アプリ再起動後に OS 側へ残っている Activity から追跡表を復元する。
// 前提: JS の追跡表はプロセスと共に消えるが、Live Activity は OS が保持し続ける(それが存在意義)。
//   起動時に無条件で消すと「強制終了→再起動」で進行中の注文表示が失われるので、
//   ContentState の status と stageStartedAt から開始時刻を逆算して進行を引き継ぐ。
//   復元できないもの(時間割に無い status)と、終端+1時間を過ぎた残骸だけを消す
async function rehydrate(): Promise<void> {
  const now = Date.now();
  const lastStage = stageAt(Number.MAX_SAFE_INTEGER);
  for (const snapshot of OrderLiveActivity.list()) {
    const stage = stageOf(snapshot.status);
    if (!stage) {
      await OrderLiveActivity.end(snapshot.orderId, snapshot.status, null);
      continue;
    }
    const startedAt = snapshot.stageStartedAtMs - stage.startsAtMs;
    if (now - startedAt > lastStage.startsAtMs + AUTO_DISMISS_MS) {
      await OrderLiveActivity.end(snapshot.orderId, snapshot.status, null);
      continue;
    }
    tracked.set(snapshot.orderId, { orderId: snapshot.orderId, startedAt, status: stage.status });
  }
  await resync();
}

// 追跡中の注文をすべて現在時刻に合わせる。ステージが変わったものだけ update / end を送る
async function resync(): Promise<void> {
  if (resyncing) return;
  resyncing = true;
  try {
    const now = Date.now();
    for (const order of [...tracked.values()]) {
      const stage = stageAt(now - order.startedAt);
      if (stage.status === order.status) continue;
      order.status = stage.status;
      if (stage.endsAtMs === null) {
        tracked.delete(order.orderId);
        await OrderLiveActivity.end(order.orderId, stage.status, order.startedAt + AUTO_DISMISS_MS);
      } else {
        await OrderLiveActivity.update(order.orderId, toActivityStage(order.startedAt, stage));
      }
    }
  } finally {
    resyncing = false;
    scheduleNextTick();
  }
}

// 追跡中の注文のうち最も近いステージ境界に1本だけタイマーを張る(注文ごとに interval を持たない)
function scheduleNextTick(): void {
  if (nextTick) clearTimeout(nextTick);
  nextTick = undefined;
  const now = Date.now();
  let next = Infinity;
  for (const order of tracked.values()) {
    const stage = stageAt(now - order.startedAt);
    if (stage.endsAtMs !== null) next = Math.min(next, order.startedAt + stage.endsAtMs);
  }
  if (next === Infinity) return;
  // 境界ちょうどだと stageAt が前のステージを返しうるので少し遅らせる
  nextTick = setTimeout(() => {
    nextTick = undefined;
    void resync();
  }, Math.max(0, next - now) + 250);
}

// 履歴タブを開いたとき(= 注文を確認した)に使う。追跡外のものも含めて消す
export async function endOrderLiveActivities(): Promise<void> {
  tracked.clear();
  if (nextTick) clearTimeout(nextTick);
  nextTick = undefined;
  await OrderLiveActivity.endAll();
}

// ルートレイアウトで1回だけ呼ぶ。起動時の復元(+期限切れの掃除)と、復帰時の追いつきを担う。
// 前提: JS のリロード(開発中の Fast Refresh でルートが再マウントされた場合を含む)でも走るが、
//   復元は冪等(同じ orderId を上書きするだけ)なので何度走っても壊れない
export function useOrderLiveActivityLifecycle(): void {
  useEffect(() => {
    if (!OrderLiveActivity.isSupported) return;
    void rehydrate();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void resync();
    });
    return () => subscription.remove();
  }, []);
}
