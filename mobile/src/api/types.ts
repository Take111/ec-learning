// Go API(api/internal/handler)の JSON 契約と1:1のリテラル型。
// 前提: フィールド名は Go 側の json タグに従属する(snake_case)。
//   Go 側の契約を変えたらここも連動して変える(コンパイルエラーで検知できるよう
//   画面はこの型経由でのみ API データに触る)

export type ProductListItem = {
  id: number;
  category_id: number;
  name: string;
  price_jpy: number;
  stock: number;
};

export type ProductListResponse = {
  products: ProductListItem[];
  next_cursor: string | null;
};

export type ProductDetail = {
  id: number;
  category_id: number;
  name: string;
  description: string | null;
  price_jpy: number;
  stock: number;
  is_active: boolean;
  avg_rating: number | null; // レビュー0件は null(0ではない)
  review_count: number;
};

export type OrderStatus = "pending" | "paid" | "shipped" | "delivered" | "cancelled";

export type OrderSummary = {
  id: number;
  status: OrderStatus;
  total_jpy: number;
  shipping_fee_jpy: number;
  ordered_at: string; // RFC3339
};

export type OrderListResponse = {
  orders: OrderSummary[];
  next_cursor: string | null;
};

export type Category = {
  id: number;
  name: string;
  parent_id: number | null; // null = 大分類(ルート)。商品は子カテゴリにのみ属する
};

export type CategoriesResponse = {
  categories: Category[];
};

export type PlaceOrderRequest = {
  user_id: number;
  address_id: number;
  items: { product_id: number; quantity: number }[];
  expected_total_jpy?: number; // 価格改定検知用(不一致なら409 price_changed)
};

export type PlaceOrderResponse = {
  id: number;
  status: OrderStatus;
  total_jpy: number;
  shipping_fee_jpy: number;
};

// writeError の形: {error: code, ...詳細}。C-4 の 409/422 エラーUXで分岐に使う
export type ApiErrorBody = {
  error: string;
  product_id?: number; // insufficient_stock
  expected_total_jpy?: number; // price_changed
  actual_total_jpy?: number; // price_changed
};
