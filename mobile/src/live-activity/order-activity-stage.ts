import { OrderStatus } from "@/api/types";

// 疑似進捗の時間割(注文確定からの経過 ms)。
// 前提: サーバーは orders.status を pending から変えない(イベントは UPDATE しない — CLAUDE.md)ため、
//   Live Activity の進行はクライアント側のシミュレーション。デモ規模(数十秒)にしてあるのは、
//   ロックして見守るデモとスクリーンショット撮影を成立させるため。本物の配送に寄せる値ではない。
//   バックエンドに状態遷移(または APNs push)を足したら、この表と stageAt ごと不要になる
export const STAGE_SCHEDULE = [
  { status: "pending", atMs: 0 },
  { status: "paid", atMs: 15_000 },
  { status: "shipped", atMs: 45_000 },
  { status: "delivered", atMs: 90_000 },
] as const satisfies readonly { status: OrderStatus; atMs: number }[];

// 進捗トラックの段数。ウィジェットには ContentState で送り、Swift 側に段数を手書きしない
export const STAGE_COUNT = STAGE_SCHEDULE.length;

// 終端(delivered)後も表示したまま残す期間。ActivityKit の .after は「今から最大4時間」なので範囲内
export const AUTO_DISMISS_MS = 60 * 60 * 1000;

export type Stage = {
  status: OrderStatus;
  index: number; // 時間割上の位置(0 始まり)
  startsAtMs: number; // 注文確定からの相対 ms
  endsAtMs: number | null; // null = 終端
};

function stageAtIndex(index: number): Stage {
  const next = STAGE_SCHEDULE[index + 1];
  return {
    status: STAGE_SCHEDULE[index].status,
    index,
    startsAtMs: STAGE_SCHEDULE[index].atMs,
    endsAtMs: next ? next.atMs : null,
  };
}

// 経過時間から現在のステージを純粋に導出する。
// 増分で進めずに毎回導出するのは、バックグラウンドで止まっていた分を復帰時に「再計算」で追いつくため
// (何ステージ飛ばしたかの帳簿を持たない)
export function stageAt(elapsedMs: number): Stage {
  let i = 0;
  while (i + 1 < STAGE_SCHEDULE.length && elapsedMs >= STAGE_SCHEDULE[i + 1].atMs) i++;
  return stageAtIndex(i);
}

// 自動消滅の時刻(注文確定から1時間)。終端到達時の dismissal policy と、
// 起動時の「期限切れの残骸」判定が同じ式を使う(ADR 009 の終了条件に対応するコードはここだけ)
export function dismissAtMs(startedAtMs: number): number {
  return startedAtMs + AUTO_DISMISS_MS;
}
