import { Pressable, StyleSheet, View } from "react-native";
import { ThemedText } from "@/components/themed-text/themed-text";
import { colors, interaction, radius, spacing } from "@/theme";
import { isHovered } from "@/utils/pressable-hovered";

// 数量の増減(詳細・カートで使用)。上限は在庫数 — 在庫以上は積めないことを
// UI側でも守る(最終防衛はサーバーの在庫引き当てUPDATE)
export function QuantityStepper({
  value,
  max,
  onChange,
}: {
  value: number;
  max: number;
  onChange: (next: number) => void;
}) {
  return (
    <View style={styles.row}>
      <StepButton label="−" disabled={value <= 1} onPress={() => onChange(value - 1)} />
      <ThemedText variant="headline" style={styles.value}>
        {value}
      </ThemedText>
      <StepButton label="＋" disabled={value >= max} onPress={() => onChange(value + 1)} />
    </View>
  );
}

function StepButton({
  label,
  disabled,
  onPress,
}: {
  label: string;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      hitSlop={6} // 視覚32pt + 6*2 で44ptのタッチターゲットを確保(HIG)
      style={(state) => [
        styles.button,
        {
          opacity: disabled
            ? interaction.disabled
            : state.pressed
              ? interaction.pressed
              : isHovered(state)
                ? interaction.hovered
                : 1,
        },
        !disabled && { cursor: "pointer" as const },
      ]}
    >
      <ThemedText variant="headline">{label}</ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  button: {
    width: 32,
    height: 32,
    borderRadius: radius.sm,
    borderCurve: "continuous",
    backgroundColor: colors.secondaryBackground,
    alignItems: "center",
    justifyContent: "center",
  },
  value: {
    minWidth: 28,
    textAlign: "center",
  },
});
