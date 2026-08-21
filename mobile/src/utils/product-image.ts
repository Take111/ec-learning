// 商品画像は picsum.photos の外部プレースホルダ(フェーズC設計判断)。
// 前提: products テーブルに画像列が無い。seed に product_id を使うことで
//   「同じ商品は一覧でも詳細でも常に同じ写真」を外部サービス側で保証する。
// 前提が変わる箇所: DB に image_url を持たせたらこのファイルごと削除。
//   ネットワーク依存なので、表示側(expo-image)は placeholder 色でのフォールバックを必ず持つ。
export function productImageUrl(
  productId: number,
  width: number,
  height: number = width,
): string {
  return `https://picsum.photos/seed/product-${productId}/${width}/${height}`;
}
