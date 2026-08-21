// C-2 用のモックデータ。API 契約型(src/api/types.ts)に準拠させ、
// C-3 で実 API に差し替えても画面側のコードが変わらないことを保証する。
// 前提: seed(tools/seed)と同じ世界観(日本語商品名・JPY整数・偏りのある評価)を再現する
import {
  Category,
  OrderSummary,
  ProductDetail,
  ProductListItem,
} from "@/api/types";

export const mockCategories: Category[] = [
  { id: 1, name: "家電", parent_id: null },
  { id: 2, name: "キッチン家電", parent_id: 1 },
  { id: 3, name: "生活家電", parent_id: 1 },
  { id: 4, name: "食品・飲料", parent_id: null },
  { id: 5, name: "コーヒー・お茶", parent_id: 4 },
  { id: 6, name: "菓子・スイーツ", parent_id: 4 },
  { id: 7, name: "インテリア", parent_id: null },
  { id: 8, name: "収納家具", parent_id: 7 },
  { id: 9, name: "照明", parent_id: 7 },
];

const productNames: [string, number, number][] = [
  // [商品名, 子カテゴリid, 価格帯の目安]
  ["全自動コーヒーメーカー", 2, 12800],
  ["電気圧力鍋 4L", 2, 15800],
  ["スティック掃除機", 3, 24800],
  ["衣類スチーマー", 3, 6980],
  ["深煎りドリップコーヒー 30袋", 5, 1980],
  ["オーガニック緑茶 ティーバッグ", 5, 880],
  ["バターサンドクッキー 12個入", 6, 2160],
  ["濃厚ガトーショコラ", 6, 2800],
  ["オーク材シェルフ 3段", 8, 19800],
  ["スタッキングボックス 3個組", 8, 4980],
  ["ペンダントライト 北欧風", 9, 8800],
  ["LEDフロアランプ", 9, 11800],
  ["ハンドブレンダー", 2, 5980],
  ["トースター 2枚焼き", 2, 7980],
  ["加湿器 上部給水式", 3, 9800],
  ["布団乾燥機", 3, 13800],
  ["カフェオレベース 無糖", 5, 1280],
  ["ほうじ茶ラテ 粉末", 5, 980],
  ["フィナンシェ 8個入", 6, 1650],
  ["塩バターキャラメル", 6, 720],
  ["テレビボード 幅120cm", 8, 29800],
  ["ウォールシェルフ 2枚組", 8, 3480],
  ["テーブルランプ 調光式", 9, 6480],
  ["間接照明 テープライト", 9, 2980],
  ["ミルクフォーマー", 2, 1980],
  ["ホットプレート 平面+たこ焼き", 2, 9980],
  ["サーキュレーター 静音", 3, 7480],
  ["電気ケトル 1.0L", 2, 4280],
  ["水出しコーヒーポット", 5, 2480],
  ["抹茶テリーヌ", 6, 3200],
];

export const mockProducts: ProductListItem[] = productNames.map(
  ([name, categoryId, price], i) => ({
    id: i + 1,
    category_id: categoryId,
    name,
    price_jpy: price,
    // 一部を在庫僅少・在庫切れにして C-4 のエラー系UXの素材にする
    stock: i % 9 === 0 ? 0 : i % 5 === 0 ? 2 : 20 + i,
  }),
);

export function mockProductDetail(id: number): ProductDetail | undefined {
  const p = mockProducts.find((p) => p.id === id);
  if (!p) return undefined;
  const hasReviews = id % 4 !== 0; // 一部をレビュー0件にする(avg_rating null の表示確認用)
  return {
    ...p,
    description:
      id % 7 === 0
        ? null
        : "毎日の暮らしに寄り添う定番アイテム。シンプルなデザインと確かな品質で、贈り物にも選ばれています。",
    is_active: true,
    avg_rating: hasReviews ? 3.2 + ((id * 7) % 18) / 10 : null,
    review_count: hasReviews ? 3 + ((id * 13) % 120) : 0,
  };
}

const statuses = ["delivered", "delivered", "shipped", "paid", "pending", "cancelled"] as const;

export const mockOrders: OrderSummary[] = Array.from({ length: 23 }, (_, i) => {
  const total = 1980 + ((i * 3517) % 28000);
  return {
    id: 300 - i,
    status: statuses[i % statuses.length],
    total_jpy: total,
    shipping_fee_jpy: total >= 5550 ? 0 : 550,
    ordered_at: new Date(Date.UTC(2026, 7, 15 - i, 3 + (i % 12), (i * 17) % 60)).toISOString(),
  };
});
