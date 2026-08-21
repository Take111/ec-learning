import { StyleSheet, View } from "react-native";
import { Button } from "@/components/button/button";
import { ThemedText } from "@/components/themed-text/themed-text";
import { colors, spacing } from "@/theme";
import { formatPrice } from "@/utils/format-price";

// C-1 のトークン確認用の仮画面。C-2 で商品一覧に置き換える
export default function Index() {
  return (
    <View style={styles.container}>
      <ThemedText variant="title">デザイントークン確認</ThemedText>
      <ThemedText variant="subhead">
        セマンティックカラーなので端末の外観モードに追従します
      </ThemedText>
      <ThemedText variant="headline">{formatPrice(12800)}</ThemedText>
      <Button title="プライマリ" onPress={() => {}} />
      <Button variant="secondary" title="セカンダリ" onPress={() => {}} />
      <Button title="ローディング" loading />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.md,
    gap: spacing.md,
  },
});
