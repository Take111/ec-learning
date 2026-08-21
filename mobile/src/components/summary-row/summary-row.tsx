import { StyleSheet, View } from "react-native";
import { ThemedText } from "@/components/themed-text/themed-text";

// 金額内訳などの「ラベル + 値」行(カート・注文確認で使用。C-4 の注文完了でも使う想定)
export function SummaryRow({
  label,
  value,
  emphasis,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
}) {
  return (
    <View style={styles.row}>
      <ThemedText variant={emphasis ? "headline" : "subhead"}>{label}</ThemedText>
      <ThemedText variant={emphasis ? "title" : "body"}>{value}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
});
