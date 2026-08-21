import { StyleSheet, View } from "react-native";
import { ThemedText } from "@/components/themed-text/themed-text";
import { spacing } from "@/theme";

// 空状態の共通表示(カート空・履歴なし・検索0件)
export function EmptyState({ title, detail }: { title: string; detail?: string }) {
  return (
    <View style={styles.container}>
      <ThemedText variant="headline" color="secondaryLabel">
        {title}
      </ThemedText>
      {detail ? <ThemedText variant="subhead">{detail}</ThemedText> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    padding: spacing.xl,
  },
});
