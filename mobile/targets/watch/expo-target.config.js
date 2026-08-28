// Watch App ターゲット定義(@bacons/apple-targets が prebuild 時に Xcode プロジェクトへ注入)。
// 前提: RN/JS は watchOS では動かないため、Watch 側は SwiftUI のネイティブ実装。
//   このディレクトリ(targets/watch/)に Watch 関連を閉じ込めることで CNG を維持する
//   (`prebuild --clean` しても消えない)。設計判断は docs/decisions/008 を参照。
// 前提: 本体アプリとのペアリング(WKCompanionAppBundleIdentifier)はプラグインが
//   ビルド設定経由で自動注入するため、ここでの指定は不要
/** @type {import('@bacons/apple-targets/app.plugin').Config} */
module.exports = {
  type: "watch",
  name: "watch",
  displayName: "mobile",
  // 先頭の "." は本体 bundleIdentifier への相対サフィックス → com.eclearning.mobile.watch
  bundleIdentifier: ".watch",
  // プラグイン既定値(9.4)の明示。NavigationStack / AsyncImage / URL.appending(path:) が
  // 使える下限が watchOS 9 なので、これより下げるならコードの書き直しが必要
  deploymentTarget: "9.4",
  icon: "../../assets/images/icon.png",
  colors: {
    // アクセントは本体アプリと同じ systemBlue 系(ライト/ダーク)。
    // 前提: RN 側(src/theme/colors.ts)は PlatformColor で実行時に OS から解決するため
    //   定数を共有できず、ここは静的 hex の複製。ブランドカラーを変えるときは
    //   colors.ts とここを連動して変える(colors.ts 側のヘッダにも同じ注意がある)
    $accent: { color: "#007AFF", darkColor: "#0A84FF" },
  },
};
