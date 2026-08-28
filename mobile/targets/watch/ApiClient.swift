import Foundation

// Watch から Go API を直接叩く最小クライアント(ADR 008 の選択肢A)。
// 前提: 閲覧のみ(GET 2本)なので、RN 側 client.ts の ApiError 契約(ボディ解釈)や
//   冪等キーは持ち込まない。Watch に書き込み系を足すことになったら、その時点で
//   エラー契約・Idempotency-Key を RN 側と同じ形で移植する議論からやり直す

enum ApiError: Error {
    case http(status: Int)
    case network(Error)
}

enum ApiClient {
    // 前提: ローカル開発専用 URL(RN 側 client.ts の BASE_URL と同じ役割)。
    //   Watch シミュレータはホストの localhost に直接届く。実機 Watch で試すときは
    //   ホストマシンの LAN IP に書き換える(例: http://192.168.x.x:8080)
    static let baseURL = URL(string: "http://localhost:8080")!

    private static let decoder: JSONDecoder = {
        let d = JSONDecoder()
        // snake_case ↔ camelCase の対応は CodingKeys の手書きではなくデコーダで一括変換
        d.keyDecodingStrategy = .convertFromSnakeCase
        return d
    }()

    static func fetch<T: Decodable>(_ path: String) async throws -> T {
        let url = baseURL.appending(path: path)
        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await URLSession.shared.data(from: url)
        } catch {
            throw ApiError.network(error)
        }
        let status = (response as? HTTPURLResponse)?.statusCode ?? 0
        guard (200..<300).contains(status) else {
            throw ApiError.http(status: status)
        }
        do {
            return try decoder.decode(T.self, from: data)
        } catch {
            throw ApiError.network(error)
        }
    }
}
