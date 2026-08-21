// 金額は整数JPY(DB設計の決定)。表示変換はこの1箇所に集約する
const yen = new Intl.NumberFormat("ja-JP", {
  style: "currency",
  currency: "JPY",
});

export function formatPrice(jpy: number): string {
  return yen.format(jpy);
}
