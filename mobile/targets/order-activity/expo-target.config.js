// 注文 Live Activity のウィジェット拡張ターゲット定義(@bacons/apple-targets が prebuild 時に注入)。
// 前提: Live Activity(ActivityKit)の UI は WidgetKit 拡張の SwiftUI でしか描けない(RN/JS は動かない)。
//   Watch(targets/watch/)と同じく、このディレクトリに閉じ込めることで CNG を維持する。
//   本体側からの開始・更新・終了は modules/order-live-activity の Expo Module が担う。
//   設計判断は docs/decisions/009 を参照
// 前提: type "widget" は WidgetKit / SwiftUI / ActivityKit / AppIntents をプラグインが自動リンクする
//   (frameworks の追加指定は不要)。Info.plist の NSExtension もプラグインが生成するが、
//   生成物がソースディレクトリに書かれる仕様なので同内容を明示的に置いてある
/** @type {import('@bacons/apple-targets/app.plugin').Config} */
module.exports = {
  type: "widget",
  // Xcode のターゲット名・Swift モジュール名。ディレクトリ名(order-activity)はモジュール名に使えないため明示
  name: "OrderActivity",
  displayName: "注文状況",
  // 先頭の "." は本体 bundleIdentifier への相対サフィックス → com.eclearning.mobile.order-activity
  bundleIdentifier: ".order-activity",
  // 本体アプリ(Expo SDK 57 の Podfile 既定 = 16.4)に揃える。ActivityKit の実用下限 16.2 を満たす。
  // プラグイン既定値(18.0)のままだと本体より対応 OS が狭くなる理由がない
  deploymentTarget: "16.4",
  colors: {
    // アクセントは本体アプリと同じ systemBlue 系。複製理由は targets/watch/expo-target.config.js と同じ
    // (RN 側は PlatformColor で実行時解決のため静的に共有できない)。キーは { light, dark }
    $accent: { light: "#007AFF", dark: "#0A84FF" },
  },
};
