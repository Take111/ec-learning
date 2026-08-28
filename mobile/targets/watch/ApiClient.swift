import Foundation

// Watch から Go API を直接叩く最小クライアント(ADR 008 の選択肢A)。
// 前提: 閲覧のみ(GET 2本)なので、RN 側 client.ts の ApiError 契約(ボディ解釈)や
//   冪等キーは持ち込まない。Watch に書き込み系を足すことになったら、その時点で
//   エラー契約・Idempotency-Key を RN 側と同じ形で移植する議論からやり直す

enum ApiError: Error {
    case http(status: Int)
    case network(Error)
    // 通信断と契約不一致(サーバー側のJSON変更など)を区別してデバッグできるよう分ける
    case decoding(Error)
}

enum ApiClient {
    // 接続先は Info.plist の ECApiBaseURL から読む(RN 側 EXPO_PUBLIC_API_URL に相当する注入点)。
    // 前提: 切り替えは「コードの書き換え」ではなく「設定の書き換え」で済ませる(仕組みで安全)。
    //   @bacons/apple-targets は Info.plist へのキー注入 API を持たないため、
    //   環境変数からの自動注入はできず、静的な plist キーが現状の最深の注入点
    static let baseURL: URL = {
        if let raw = Bundle.main.object(forInfoDictionaryKey: "ECApiBaseURL") as? String,
           let url = URL(string: raw) {
            return url
        }
        // Info.plist に無い場合のフォールバック(ローカル開発の既定)
        return URL(string: "http://localhost:8080")!
    }()

    private static let decoder: JSONDecoder = {
        let d = JSONDecoder()
        // snake_case ↔ camelCase の対応は CodingKeys の手書きではなくデコーダで一括変換
        d.keyDecodingStrategy = .convertFromSnakeCase
        return d
    }()

    static func fetch<T: Decodable>(_ path: String) async throws -> T {
        // 呼び出し側は "/products" のように先頭スラッシュ付きで渡す(RN 側 client.ts と同じ流儀)。
        // appending(path:) に "/" 始まりを渡したときの区切り正規化は実装依存なので、ここで除いておく
        let url = baseURL.appending(path: path.hasPrefix("/") ? String(path.dropFirst()) : path)
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
            throw ApiError.decoding(error)
        }
    }
}
