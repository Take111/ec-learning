import { OrderStatus } from "@/api/types";
import { colors } from "@/theme";

// status(DBのCHECK列挙)→ 表示ラベルと色トークン名。履歴と注文完了の2画面で使う。
// 色は実値でなく名前で返し、適用は ThemedText の color プロップに一本化する
export const orderStatusLabel: Record<OrderStatus, string> = {
  pending: "支払い待ち",
  paid: "支払い済み",
  shipped: "発送済み",
  delivered: "配達完了",
  cancelled: "キャンセル",
};

export const orderStatusColor: Record<OrderStatus, keyof typeof colors> = {
  pending: "secondaryLabel",
  paid: "accent",
  shipped: "info", // paid と同色だと一覧で区別不能(C-3.5 監査での指摘)
  delivered: "success",
  cancelled: "destructive",
};
