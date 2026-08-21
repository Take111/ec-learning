import { ViewStyle } from "react-native";
import { colors } from "./colors";
import { radius } from "./radius";
import { spacing } from "./spacing";

// 「一段沈んだカード面」の合成スタイル(colors.secondaryBackground の定義と対)。
// カート集計・チェックアウトのセクション・注文完了サマリーの3画面で共有。
// gap や margin は面の責務ではないので各画面側に残す
export const surfaces = {
  card: {
    backgroundColor: colors.secondaryBackground,
    borderRadius: radius.md,
    borderCurve: "continuous",
    padding: spacing.md,
  },
} as const satisfies Record<string, ViewStyle>;
