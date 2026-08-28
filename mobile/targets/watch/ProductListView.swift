import SwiftUI

// 商品一覧(先頭1ページ=20件のみ)。
// 前提: Watch は glanceable な端末なので、RN 側の無限スクロール(next_cursor)は
//   あえて持ち込まない(ADR 008)。全件を眺めたいユースケースは iPhone 側の役割
struct ProductListView: View {
    @State private var phase: LoadPhase<[ProductListItem]> = .loading

    var body: some View {
        PhaseView(phase: phase, retry: { Task { await load() } }) { products in
            List(products) { product in
                NavigationLink(value: product.id) {
                    ProductRow(product: product)
                }
            }
            .navigationDestination(for: Int.self) { id in
                ProductDetailView(productId: id)
            }
        }
        .navigationTitle("商品")
        .task {
            // .task は詳細画面から戻るたびに再実行される(表示のたび)。取得済みなら
            // 再フェッチしない — Watch の電池・通信を守る。明示的な再取得は「再試行」だけ
            if case .loaded = phase { return }
            await load()
        }
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
            ProductImage(productId: product.id, pixelSize: 80)
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
