import { ApiErrorBody } from "@/api/types";

// API エラーの契約。成功系のシグネチャと同様、エラーの形もここで固定する
// (仕組みで安全: TanStack Query の error に乗る型が画面との境界の半分)。
// C-4 の 409/422 エラーUXは instanceof ApiError + body.error コードで分岐する
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly body: ApiErrorBody,
  ) {
    super(body.error);
    this.name = "ApiError";
  }
}
