// API クライアント。C-2 ではモック実装、C-3 で fetch 実装に中身だけ差し替える。
// 前提: 関数シグネチャ(=画面との境界)はこのファイルで固定する。
//   画面・フック側は差し替えを感知しない
import {
  CategoriesResponse,
  OrderListResponse,
  PlaceOrderRequest,
  PlaceOrderResponse,
  ProductDetail,
  ProductListResponse,
} from "@/api/types";
import { ApiError } from "@/api/errors";
import {
  mockCategories,
  mockOrders,
  mockProductDetail,
  mockProducts,
} from "@/mocks/mock-data";

const PAGE_SIZE = 10;

// ローディング表示の確認用に実 API 相当の遅延を模す
const delay = () => new Promise((r) => setTimeout(r, 300));

// モックのカーソルは「次ページの開始オフセット」の文字列(実APIでは base64 の不透明カーソル)
function paginate<T>(all: T[], cursor: string | undefined) {
  const start = cursor ? Number(cursor) : 0;
  const page = all.slice(start, start + PAGE_SIZE);
  const next = start + PAGE_SIZE < all.length ? String(start + PAGE_SIZE) : null;
  return { page, next };
}

export async function listCategories(): Promise<CategoriesResponse> {
  await delay();
  return { categories: mockCategories };
}

export async function listProducts(params: {
  categoryId?: number;
  cursor?: string;
}): Promise<ProductListResponse> {
  await delay();
  const filtered = params.categoryId
    ? mockProducts.filter((p) => p.category_id === params.categoryId)
    : mockProducts;
  const { page, next } = paginate(filtered, params.cursor);
  return { products: page, next_cursor: next };
}

export async function getProductDetail(id: number): Promise<ProductDetail> {
  await delay();
  const detail = mockProductDetail(id);
  if (!detail) throw new ApiError(404, { error: "product_not_found" });
  return detail;
}

export async function listOrders(params: {
  cursor?: string;
}): Promise<OrderListResponse> {
  await delay();
  const { page, next } = paginate(mockOrders, params.cursor);
  return { orders: page, next_cursor: next };
}

export async function placeOrder(
  req: PlaceOrderRequest,
  _idempotencyKey: string,
): Promise<PlaceOrderResponse> {
  await delay();
  // モックは常に成功。C-3 で実装を差し替え、C-4 で 409/422 のエラーUXを作り込む
  return {
    id: 301,
    status: "pending",
    total_jpy: 0,
    shipping_fee_jpy: 0,
  };
}
