import { requireOptionalNativeModule } from "expo";

// 注文 Live Activity のネイティブ橋(ios/OrderLiveActivityModule.swift)の TS 面。
// 前提: expo-module.config.json で apple のみ登録しているため、Android / web ではモジュール自体が
//   リンクされず native は null。呼び出し側は Platform 分岐を書かず、isSupported と no-op に任せる
//   (.web.tsx 分岐と同じ「画面はプラットフォームを意識しない」方針)
// 前提: 時刻はすべてエポック ms(JS の Date.now())で渡す。status は src/api/types.ts の OrderStatus 文字列

// 注文確定時に決まり、以後変わらない値(ActivityAttributes)
export type OrderActivityOrder = {
  orderId: number;
  totalJpy: number;
  itemCount: number;
  startedAtMs: number;
  stageCount: number;
};
// 現在のステージ(ContentState)。start / update / end のどれも同じ形で受ける
export type OrderActivityStage = {
  status: string;
  index: number;
  stageStartedAtMs: number;
  stageEndsAtMs: number | null; // null = 終端
};
// OS が保持している進行中の Activity。アプリ再起動後に追跡を復元するために読む
export type OrderActivitySnapshot = { orderId: number; startedAtMs: number; status: string };

type NativeOrderLiveActivity = {
  start(
    orderId: number,
    totalJpy: number,
    itemCount: number,
    startedAtMs: number,
    stageCount: number,
    status: string,
    stageIndex: number,
    stageStartedAtMs: number,
    stageEndsAtMs: number | null,
  ): Promise<boolean>;
  update(
    orderId: number,
    status: string,
    stageIndex: number,
    stageStartedAtMs: number,
    stageEndsAtMs: number | null,
  ): Promise<void>;
  end(
    orderId: number,
    status: string,
    stageIndex: number,
    stageStartedAtMs: number,
    dismissAtMs: number | null,
  ): Promise<void>;
  list(): Promise<OrderActivitySnapshot[]>;
  endAll(): Promise<void>;
};

const native = requireOptionalNativeModule<NativeOrderLiveActivity>("OrderLiveActivity");

export const OrderLiveActivity = {
  isSupported: native != null,

  // 表示できたら true。既に同じ orderId の Activity があれば更新に倒す(ネイティブ側で照合)
  async start(order: OrderActivityOrder, stage: OrderActivityStage): Promise<boolean> {
    return (
      (await native?.start(
        order.orderId,
        order.totalJpy,
        order.itemCount,
        order.startedAtMs,
        order.stageCount,
        stage.status,
        stage.index,
        stage.stageStartedAtMs,
        stage.stageEndsAtMs,
      )) ?? false
    );
  },

  async update(orderId: number, stage: OrderActivityStage): Promise<void> {
    await native?.update(orderId, stage.status, stage.index, stage.stageStartedAtMs, stage.stageEndsAtMs);
  },

  // 終端状態を表示したまま dismissAtMs まで残す。null なら即時に消す
  async end(orderId: number, stage: OrderActivityStage, dismissAtMs: number | null): Promise<void> {
    await native?.end(orderId, stage.status, stage.index, stage.stageStartedAtMs, dismissAtMs);
  },

  async list(): Promise<OrderActivitySnapshot[]> {
    return (await native?.list()) ?? [];
  },

  async endAll(): Promise<void> {
    await native?.endAll();
  },
};
