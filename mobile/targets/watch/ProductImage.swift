import SwiftUI

// 商品画像は picsum.photos(seed=product_id)— mobile/src/utils/product-image.ts と同じ規約。
// DB に画像カラムを持たないための外部プレースホルダなので、URL の組み立て規則を揃えておく
func productImageURL(id: Int, size: Int) -> URL {
    URL(string: "https://picsum.photos/seed/product-\(id)/\(size)/\(size)")!
}

// 取得+プレースホルダの共通部分。フレーム・角丸は使う側が指定する
struct ProductImage: View {
    let productId: Int
    /// 要求する画像のピクセル数。表示サイズの2倍(@2x)を目安に指定して通信量を抑える
    let pixelSize: Int

    var body: some View {
        AsyncImage(url: productImageURL(id: productId, size: pixelSize)) { image in
            image.resizable().scaledToFill()
        } placeholder: {
            Color.gray.opacity(0.2)
        }
    }
}
