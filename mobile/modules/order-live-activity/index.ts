import { requireOptionalNativeModule } from "expo";

// 注文 Live Activity のネイティブ橋(ios/OrderLiveActivityModule.swift)の TS 面。
// 前提: expo-module.config.json で apple のみ登録しているため、Android / web ではモジュール自体が
//   リンクされず native は null。呼び出し側は Platform 分岐を書かず、isSupported と no-op に任せる
//   (.web.tsx 分岐と同じ「画面はプラットフォームを意識しない」方針)
// 前提: 時刻はすべてエポック ms(JS の Date.now())で渡す。status は src/api/types.ts の OrderStatus 文字列
type NativeOrderLiveActivity = {
  start(
    orderId: number,
    totalJpy: number,
    itemCount: number,
    status: string,
    stageStartedAtMs: number,
    stageEndsAtMs: number | null,
  ): Promise<boolean>;
  update(
    orderId: number,
    status: string,
    stageStartedAtMs: number,
    stageEndsAtMs: number | null,
  ): Promise<void>;
  end(orderId: number, status: string, dismissAtMs: number | null): Promise<void>;
  list(): { orderId: number; status: string; stageStartedAtMs: number }[];
  endAll(): Promise<void>;
};

const native = requireOptionalNativeModule<NativeOrderLiveActivity>("OrderLiveActivity");

export type OrderActivityOrder = { orderId: number; totalJpy: number; itemCount: number };
export type OrderActivityStage = {
  status: string;
  stageStartedAtMs: number;
  stageEndsAtMs: number | null; // null = 終端
};
export type OrderActivitySnapshot = { orderId: number; status: string; stageStartedAtMs: number };

export const OrderLiveActivity = {
  isSupported: native != null,

  // 表示できたら true。既に同じ orderId の Activity があれば更新に倒す(ネイティブ側で照合)
  start(order: OrderActivityOrder, stage: OrderActivityStage): Promise<boolean> {
    if (!native) return Promise.resolve(false);
    return native.start(
      order.orderId,
      order.totalJpy,
      order.itemCount,
      stage.status,
      stage.stageStartedAtMs,
      stage.stageEndsAtMs,
    );
  },

  update(orderId: number, stage: OrderActivityStage): Promise<void> {
    if (!native) return Promise.resolve();
    return native.update(orderId, stage.status, stage.stageStartedAtMs, stage.stageEndsAtMs);
  },

  // 終端状態を表示したまま dismissAtMs まで残す
  end(orderId: number, status: string, dismissAtMs: number | null): Promise<void> {
    if (!native) return Promise.resolve();
    return native.end(orderId, status, dismissAtMs);
  },

  // 進行中の Activity(OS が保持している分)。アプリ再起動後に追跡を復元するために読む
  list(): OrderActivitySnapshot[] {
    return native?.list() ?? [];
  },

  endAll(): Promise<void> {
    if (!native) return Promise.resolve();
    return native.endAll();
  },
};
