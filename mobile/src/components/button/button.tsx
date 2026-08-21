import {
  ActivityIndicator,
  Pressable,
  StyleProp,
  StyleSheet,
  ViewStyle,
} from "react-native";
import { colors, radius, spacing } from "@/theme";
import { ThemedText } from "@/components/themed-text/themed-text";

// バリアントは実際の画面が必要としたときだけ足す(現時点: 注文確定=primary、数量操作=secondary)
const variants = {
  primary: { backgroundColor: colors.accent, textColor: "onAccent" },
  secondary: { backgroundColor: colors.secondaryBackground, textColor: "label" },
} as const satisfies Record<
  string,
  { backgroundColor: (typeof colors)[keyof typeof colors]; textColor: keyof typeof colors }
>;

export function Button({
  variant = "primary",
  size = "md",
  title,
  loading,
  disabled,
  style,
  onPress,
}: {
  variant?: keyof typeof variants;
  size?: keyof typeof styles.sizes;
  title: string;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
}) {
  const { backgroundColor, textColor } = variants[variant];
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        styles.sizes[size],
        { backgroundColor, opacity: disabled ? 0.4 : pressed ? 0.7 : 1 },
        style, // 呼び出し側の上書きはレイアウトのみ(色を変えたくなったらバリアント不足のサイン)
      ]}
    >
      {loading ? (
        <ActivityIndicator color={colors[textColor]} />
      ) : (
        <ThemedText variant="headline" color={textColor}>
          {title}
        </ThemedText>
      )}
    </Pressable>
  );
}

const styles = {
  ...StyleSheet.create({
    base: {
      borderRadius: radius.md,
      borderCurve: "continuous",
      alignItems: "center",
    },
  }),
  sizes: StyleSheet.create({
    sm: { paddingVertical: spacing.xs, paddingHorizontal: spacing.sm },
    // 12 はトークン外を意図的に使用(タップ高さの都合。再出現したら spacing に昇格)
    md: { paddingVertical: 12, paddingHorizontal: spacing.md },
  }),
};
