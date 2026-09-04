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

// 終端(delivered)後も表示したまま残す期間。ActivityKit の .after は「今から最大4時間」なので範囲内
export const AUTO_DISMISS_MS = 60 * 60 * 1000;

export type Stage = {
  status: OrderStatus;
  startsAtMs: number; // 注文確定からの相対 ms
  endsAtMs: number | null; // null = 終端
};

// status から時間割の位置を引く(アプリ再起動時に OS 側の Activity から開始時刻を逆算するため)。
// 時間割に無い status(cancelled など)は進行系ではないので undefined
export function stageOf(status: string): Stage | undefined {
  const i = STAGE_SCHEDULE.findIndex((s) => s.status === status);
  if (i < 0) return undefined;
  const next = STAGE_SCHEDULE[i + 1];
  return {
    status: STAGE_SCHEDULE[i].status,
    startsAtMs: STAGE_SCHEDULE[i].atMs,
    endsAtMs: next ? next.atMs : null,
  };
}

// 経過時間から現在のステージを純粋に導出する。
// 増分で進めずに毎回導出するのは、バックグラウンドで止まっていた分を復帰時に「再計算」で追いつくため
// (何ステージ飛ばしたかの帳簿を持たない)
export function stageAt(elapsedMs: number): Stage {
  let i = 0;
  while (i + 1 < STAGE_SCHEDULE.length && elapsedMs >= STAGE_SCHEDULE[i + 1].atMs) i++;
  const next = STAGE_SCHEDULE[i + 1];
  return {
    status: STAGE_SCHEDULE[i].status,
    startsAtMs: STAGE_SCHEDULE[i].atMs,
    endsAtMs: next ? next.atMs : null,
  };
}
