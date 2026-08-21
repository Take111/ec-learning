// API クライアント(C-3: 実装を fetch に差し替え済み。関数シグネチャ=画面との境界は C-2 から不変)。
// エラーは常に ApiError{status, body} で throw する(契約は api/errors.ts)。
// ネットワーク断・API未起動も status=0 の ApiError に畳む — C-4 は instanceof 1本で分岐できる
import { Platform } from "react-native";
import { ApiError } from "@/api/errors";
import {
  CategoriesResponse,
  OrderListResponse,
  PlaceOrderRequest,
  PlaceOrderResponse,
  ProductDetail,
  ProductListResponse,
} from "@/api/types";
import { DEMO_USER_ID } from "@/constants";

// 前提: ローカル開発専用のURL。iOSシミュレータはホストの localhost に直接届くが、
//   Androidエミュレータは 10.0.2.2 がホスト。実機で試すときは EXPO_PUBLIC_API_URL に
//   ホストマシンのLAN IPを渡す(例: EXPO_PUBLIC_API_URL=http://192.168.x.x:8080)
const BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ??
  Platform.select({
    android: "http://10.0.2.2:8080",
    default: "http://localhost:8080",
  });

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, init);
  } catch (e) {
    // 中断(AbortSignal)は TanStack Query が握るのでそのまま流す
    if (e instanceof Error && e.name === "AbortError") throw e;
    throw new ApiError(0, { error: "network_error" });
  }
  if (!res.ok) {
    // エラーボディが JSON でない場合(ゲートウェイ等)もApiError契約に畳む
    const body = await res.json().catch(() => ({ error: `http_${res.status}` }));
    throw new ApiError(res.status, body);
  }
  return res.json();
}

export function listCategories(signal?: AbortSignal): Promise<CategoriesResponse> {
  return request("/categories", { signal });
}

export function listProducts(
  params: { categoryId?: number; cursor?: string },
  signal?: AbortSignal,
): Promise<ProductListResponse> {
  const q = new URLSearchParams();
  if (params.categoryId) q.set("category_id", String(params.categoryId));
  if (params.cursor) q.set("cursor", params.cursor);
  const qs = q.toString();
  return request(qs ? `/products?${qs}` : "/products", { signal });
}

export function getProductDetail(
  id: number,
  signal?: AbortSignal,
): Promise<ProductDetail> {
  return request(`/products/${id}`, { signal });
}

export function listOrders(
  params: { cursor?: string },
  signal?: AbortSignal,
): Promise<OrderListResponse> {
  const q = new URLSearchParams({ user_id: String(DEMO_USER_ID) });
  if (params.cursor) q.set("cursor", params.cursor);
  return request(`/orders?${q}`, { signal });
}

// user_id は client が注入する(認証導入時にセッション由来へ差し替わる座席。
// 画面は「誰の注文か」を知らない)。address_id は画面の選択物なので画面から渡す
export function placeOrder(
  req: Omit<PlaceOrderRequest, "user_id">,
  idempotencyKey: string,
): Promise<PlaceOrderResponse> {
  return request("/orders", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      // リトライ時に同じキーを送ることで、二重注文をサーバー側 UNIQUE 制約が吸収する
      "Idempotency-Key": idempotencyKey,
    },
    body: JSON.stringify({ ...req, user_id: DEMO_USER_ID } satisfies PlaceOrderRequest),
  });
}
