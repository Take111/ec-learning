import { useEffect } from "react";
import { AppState } from "react-native";
import { OrderActivityStage, OrderLiveActivity } from "../../modules/order-live-activity";
import { dismissAtMs, Stage, stageAt, STAGE_COUNT } from "./order-activity-stage";

// 注文 Live Activity の JS 側コントローラ。開始・疑似進捗の駆動・終了を一手に持つ。
// 前提(バックグラウンド): JS のタイマーはアプリがサスペンドされると止まる。ActivityKit にも
//   「将来の状態を予約する」API は無く、停止中に状態を進める正道は APNs push(サーバー側ジョブ)だけ。
//   push 基盤の無い本プロジェクトでは、
//     1. フォアグラウンド中は setTimeout で次のステージ境界に更新し、
//     2. 復帰時(AppState active)に経過時間から現在ステージを再計算して追いつく
//   方式にしている。ロック中に動くのはウィジェット側の timerInterval 表示だけ(ADR 009)。
// 前提(二重開始): POST /orders の冪等リプレイ(200)は JS からは 201 と区別できないため、
//   追跡表に同じ orderId があれば何もしない。JS の追跡表に無くネイティブにだけある場合
//   (起動直後の復元前など)はネイティブ側が照合して update に倒す
type Tracked = { startedAt: number; status: Stage["status"] };

const tracked = new Map<number, Tracked>();
let nextTick: ReturnType<typeof setTimeout> | undefined;

// 追跡表を触る操作(開始・復元・タイマー・復帰・終了)は1本の Promise 連鎖に直列化する。
// 起動時の復元中に履歴タブが終了を呼ぶ、といった交錯を await の順序に頼らず防ぐ
let chain: Promise<void> = Promise.resolve();
function enqueue(task: () => Promise<void>): Promise<void> {
  chain = chain.then(task).catch((e) => {
    // ActivityKit の同時数上限などで失敗しても注文処理には影響しない(表示できなかっただけ)
    console.warn("Live Activity の操作に失敗しました(注文自体には影響しません)", e);
  });
  return chain;
}

function toActivityStage(startedAt: number, stage: Stage): OrderActivityStage {
  return {
    status: stage.status,
    index: stage.index,
    stageStartedAtMs: startedAt + stage.startsAtMs,
    stageEndsAtMs: stage.endsAtMs === null ? null : startedAt + stage.endsAtMs,
  };
}

// 注文確定直後に呼ぶ。iOS 以外・Live Activity 無効時はネイティブ側が false を返すので何も残らない
export function startOrderLiveActivity(order: {
  orderId: number;
  totalJpy: number;
  itemCount: number;
}): Promise<void> {
  return enqueue(async () => {
    if (tracked.has(order.orderId)) return;
    const startedAt = Date.now();
    const stage = stageAt(0);
    const started = await OrderLiveActivity.start(
      { ...order, startedAtMs: startedAt, stageCount: STAGE_COUNT },
      toActivityStage(startedAt, stage),
    );
    if (!started) return;
    tracked.set(order.orderId, { startedAt, status: stage.status });
    scheduleNextTick();
  });
}

// 追跡中の注文をすべて現在時刻に合わせる。ステージが変わったものだけ update / end を送る
async function resync(): Promise<void> {
  const now = Date.now();
  for (const [orderId, order] of tracked) {
    const stage = stageAt(now - order.startedAt);
    if (stage.status === order.status) continue;
    order.status = stage.status;
    const activityStage = toActivityStage(order.startedAt, stage);
    if (stage.endsAtMs === null) {
      tracked.delete(orderId);
      await OrderLiveActivity.end(orderId, activityStage, dismissAtMs(order.startedAt));
    } else {
      await OrderLiveActivity.update(orderId, activityStage);
    }
  }
  scheduleNextTick();
}

// アプリ再起動後に OS 側へ残っている Activity から追跡表を復元する。
// 前提: JS の追跡表はプロセスと共に消えるが、Live Activity は OS が保持し続ける(それが存在意義)。
//   起動時に無条件で消すと「強制終了→再起動」で進行中の注文表示が失われるので、
//   Attributes に持たせた開始時刻から進行を引き継ぎ、自動消滅の期限を過ぎた残骸だけを消す
async function rehydrate(): Promise<void> {
  const now = Date.now();
  for (const snapshot of await OrderLiveActivity.list()) {
    if (now > dismissAtMs(snapshot.startedAtMs)) {
      const stage = stageAt(now - snapshot.startedAtMs);
      await OrderLiveActivity.end(snapshot.orderId, toActivityStage(snapshot.startedAtMs, stage), null);
      continue;
    }
    tracked.set(snapshot.orderId, {
      startedAt: snapshot.startedAtMs,
      status: snapshot.status as Stage["status"],
    });
  }
  await resync();
}

function clearNextTick(): void {
  clearTimeout(nextTick);
  nextTick = undefined;
}

// 追跡中の注文のうち最も近いステージ境界に1本だけタイマーを張る(注文ごとに interval を持たない)
function scheduleNextTick(): void {
  clearNextTick();
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
    void enqueue(resync);
  }, Math.max(0, next - now) + 250);
}

// 履歴タブを開いたとき(= 注文を確認した)に使う。追跡外のものも含めて消す
export function endOrderLiveActivities(): Promise<void> {
  return enqueue(async () => {
    tracked.clear();
    clearNextTick();
    await OrderLiveActivity.endAll();
  });
}

// ルートレイアウトで1回だけ呼ぶ。起動時の復元(+期限切れの掃除)と、復帰時の追いつきを担う。
// 前提: JS のリロード(開発中の Fast Refresh でルートが再マウントされた場合を含む)でも走るが、
//   復元は冪等(同じ orderId を上書きするだけ)なので何度走っても壊れない
export function useOrderLiveActivityLifecycle(): void {
  useEffect(() => {
    // iOS 以外は AppState の購読ごと不要(ネイティブ呼び出し自体は no-op だが、購読を残す理由がない)
    if (!OrderLiveActivity.isSupported) return;
    void enqueue(rehydrate);
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void enqueue(resync);
    });
    return () => subscription.remove();
  }, []);
}
