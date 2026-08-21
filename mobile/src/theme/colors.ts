import { Platform } from "react-native";
import { Color } from "expo-router";

// セマンティックカラー(端末側でライト/ダークに自動追従する)を唯一の配色源にする。
// 前提: アクセント「青系1色」はプラットフォームの systemBlue / primary をそのまま採用。
//   独自ブランド色が必要になったら、ここを hook ベースの light/dark ペアに切り替える
//   (静的トークンからは参照できなくなる境界に注意)。
// 前提: default(web)はライト固定。web は開発プレビュー用途のため。
//   web でもダーク対応するなら useColorScheme ベースの palette に作り直す。
// 前提: Android の dynamic 色はモジュール評価時のスナップショット(実行中のテーマ
//   変更に追従しない)。本プロジェクトは iOS 優先のため許容 — Android を一級対応
//   するときは colors を useColors() フックに変えて追従させる。
export const colors = {
  label: Platform.select({
    ios: Color.ios.label,
    android: Color.android.dynamic.onSurface,
    default: "#000000",
  })!,
  secondaryLabel: Platform.select({
    ios: Color.ios.secondaryLabel,
    android: Color.android.dynamic.onSurfaceVariant,
    default: "#3c3c43",
  })!,
  separator: Platform.select({
    ios: Color.ios.separator,
    android: Color.android.dynamic.outlineVariant,
    default: "#c6c6c8",
  })!,
  background: Platform.select({
    ios: Color.ios.systemBackground,
    android: Color.android.dynamic.surface,
    default: "#ffffff",
  })!,
  // カード・入力欄など一段沈んだ面
  secondaryBackground: Platform.select({
    ios: Color.ios.secondarySystemBackground,
    android: Color.android.dynamic.surfaceContainer,
    default: "#f2f2f7",
  })!,
  accent: Platform.select({
    ios: Color.ios.systemBlue,
    android: Color.android.dynamic.primary,
    default: "#007aff",
  })!,
  // 409ダイアログ・在庫切れなどエラー系UXの専用色(フェーズCの見せ場)
  destructive: Platform.select({
    ios: Color.ios.systemRed,
    android: Color.android.dynamic.error,
    default: "#ff3b30",
  })!,
  // 注文ステータス用: 完了系(delivered)と進行系(shipped)を別色相にする。
  // Android の dynamic パレットに緑/ティール系のセマンティックが無いため、
  // Android/web は iOS システム色相当の固定値でフォールバック
  success: Platform.select({
    ios: Color.ios.systemGreen,
    default: "#34c759",
  })!,
  info: Platform.select({
    ios: Color.ios.systemTeal,
    default: "#30b0c7",
  })!,
  // アクセント面の上の文字は両モードで白固定(意図的な非セマンティック)
  onAccent: "#ffffff",
} as const;
