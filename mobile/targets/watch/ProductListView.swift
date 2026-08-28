import SwiftUI

// 商品一覧(先頭1ページ=20件のみ)。
// 前提: Watch は glanceable な端末なので、RN 側の無限スクロール(next_cursor)は
//   あえて持ち込まない(ADR 008)。全件を眺めたいユースケースは iPhone 側の役割
struct ProductListView: View {
    enum Phase {
        case loading
        case loaded([ProductListItem])
        case failed
    }

    @State private var phase: Phase = .loading

    var body: some View {
        Group {
            switch phase {
            case .loading:
                ProgressView()
            case .failed:
                VStack(spacing: 8) {
                    Text("読み込みに失敗しました")
                        .font(.footnote)
                    Button("再試行") {
                        Task { await load() }
                    }
                }
            case .loaded(let products):
                List(products) { product in
                    NavigationLink(value: product.id) {
                        ProductRow(product: product)
                    }
                }
                .navigationDestination(for: Int.self) { id in
                    ProductDetailView(productId: id)
                }
            }
        }
        .navigationTitle("商品")
        .task { await load() }
    }

    private func load() async {
        phase = .loading
        do {
            let res: ProductListResponse = try await ApiClient.fetch("/products")
            phase = .loaded(res.products)
        } catch {
            phase = .failed
        }
    }
}

struct ProductRow: View {
    let product: ProductListItem

    var body: some View {
        HStack(spacing: 8) {
            // 表示サイズ(36pt)に対し @2x 相当の 80px を要求して通信量を抑える
            AsyncImage(url: productImageURL(id: product.id, size: 80)) { image in
                image.resizable().scaledToFill()
            } placeholder: {
                Color.gray.opacity(0.2)
            }
            .frame(width: 36, height: 36)
            .clipShape(RoundedRectangle(cornerRadius: 8))

            VStack(alignment: .leading, spacing: 2) {
                Text(product.name)
                    .font(.footnote)
                    .lineLimit(2)
                Text("¥\(product.priceJpy.formatted())")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }
        }
    }
}
