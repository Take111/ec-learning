import Foundation

// Go API(api/internal/handler)の JSON 契約と 1:1 — mobile/src/api/types.ts の Swift 版。
// 前提: Go 側は snake_case。デコーダの .convertFromSnakeCase 前提で camelCase 命名にしている
//   (CodingKeys の手書きはしない)。Go 側の契約を変えたら types.ts とここを連動して変える

struct ProductListItem: Decodable, Identifiable {
    let id: Int
    let categoryId: Int
    let name: String
    let priceJpy: Int
    let stock: Int
}

struct ProductListResponse: Decodable {
    let products: [ProductListItem]
    let nextCursor: String?
}

struct ProductDetail: Decodable {
    let id: Int
    let categoryId: Int
    let name: String
    let description: String?
    let priceJpy: Int
    let stock: Int
    let isActive: Bool
    let avgRating: Double? // レビュー0件は null(0ではない)— RN 側と同じ契約
    let reviewCount: Int
}

// 商品画像は picsum.photos(seed=product_id)— mobile/src/utils/product-image.ts と同じ規約。
// DB に画像カラムを持たないための外部プレースホルダなので、URL の組み立て規則を揃えておく
func productImageURL(id: Int, size: Int) -> URL {
    URL(string: "https://picsum.photos/seed/product-\(id)/\(size)/\(size)")!
}
