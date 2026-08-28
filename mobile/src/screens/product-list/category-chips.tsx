import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Category } from "@/api/types";
import { ThemedText } from "@/components/themed-text/themed-text";
import { colors, interaction, radius, spacing } from "@/theme";
import { isHovered } from "@/utils/pressable-hovered";

// 大分類→子カテゴリの2段チップ(設計判断: APIは子カテゴリ単位のみ対応のため、
// 大分類は「子チップを出すための入口」であり、それ自体では絞り込まない)
export function CategoryChips({
  categories,
  selectedParentId,
  selectedChildId,
  onSelectParent,
  onSelectChild,
}: {
  categories: Category[];
  selectedParentId: number | null;
  selectedChildId: number | null;
  onSelectParent: (id: number | null) => void;
  onSelectChild: (id: number | null) => void;
}) {
  const parents = categories.filter((c) => c.parent_id === null);
  const children = selectedParentId
    ? categories.filter((c) => c.parent_id === selectedParentId)
    : [];

  return (
    <View style={styles.container}>
      <ChipRow>
        <Chip
          label="すべて"
          selected={selectedParentId === null}
          onPress={() => onSelectParent(null)}
        />
        {parents.map((c) => (
          <Chip
            key={c.id}
            label={c.name}
            selected={selectedParentId === c.id}
            onPress={() => onSelectParent(c.id)}
          />
        ))}
      </ChipRow>
      {children.length > 0 && (
        <ChipRow>
          {children.map((c) => (
            <Chip
              key={c.id}
              label={c.name}
              selected={selectedChildId === c.id}
              onPress={() => onSelectChild(selectedChildId === c.id ? null : c.id)}
            />
          ))}
        </ChipRow>
      )}
    </View>
  );
}

function ChipRow({ children }: { children: React.ReactNode }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
    >
      {children}
    </ScrollView>
  );
}

function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      hitSlop={4} // 視覚高さ約36pt + 4*2 で44ptのタッチターゲットを確保(HIG)
      style={(state) => [
        styles.chip,
        selected && styles.chipSelected,
        state.pressed
          ? { opacity: interaction.pressed }
          : isHovered(state) && { opacity: interaction.hovered },
      ]}
    >
      <ThemedText variant="subhead" color={selected ? "onAccent" : "label"} numberOfLines={1}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  row: {
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  chip: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
    backgroundColor: colors.secondaryBackground,
    cursor: "pointer",
  },
  chipSelected: {
    backgroundColor: colors.accent,
  },
});
