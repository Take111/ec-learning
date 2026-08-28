import SwiftUI

// 商品詳細。在庫・評価・説明は一覧レスポンスに含まれない契約なので、詳細APIを個別に叩く
// (一覧を軽く保つ API 設計の帰結 — RN 側の一覧/詳細分離と同じ)
struct ProductDetailView: View {
    let productId: Int

    enum Phase {
        case loading
        case loaded(ProductDetail)
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
            case .loaded(let product):
                detail(product)
            }
        }
        .navigationTitle("詳細")
        .task { await load() }
    }

    private func detail(_ product: ProductDetail) -> some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 8) {
                AsyncImage(url: productImageURL(id: product.id, size: 300)) { image in
                    image.resizable().scaledToFill()
                } placeholder: {
                    Color.gray.opacity(0.2)
                }
                .aspectRatio(4 / 3, contentMode: .fit)
                .clipShape(RoundedRectangle(cornerRadius: 12))

                Text(product.name)
                    .font(.headline)

                Text("¥\(product.priceJpy.formatted())")
                    .font(.title3)
                    .bold()

                if product.stock > 0 {
                    Text("在庫あり(\(product.stock)点)")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                } else {
                    Text("在庫切れ")
                        .font(.caption)
                        .foregroundStyle(.red)
                }

                if let rating = product.avgRating {
                    HStack(spacing: 4) {
                        Image(systemName: "star.fill")
                            .foregroundStyle(.yellow)
                        Text("\(rating, specifier: "%.1f")(\(product.reviewCount)件)")
                    }
                    .font(.caption)
                } else {
                    // レビュー0件は null 契約(0.0 と区別)なので表示も分ける
                    Text("レビューなし")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }

                if let description = product.description, !description.isEmpty {
                    Text(description)
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
            }
        }
    }

    private func load() async {
        phase = .loading
        do {
            phase = .loaded(try await ApiClient.fetch("/products/\(productId)"))
        } catch {
            phase = .failed
        }
    }
}
