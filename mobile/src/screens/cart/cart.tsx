import { FlatList, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { Button } from "@/components/button/button";
import { EmptyState } from "@/components/empty-state/empty-state";
import { SummaryRow } from "@/components/summary-row/summary-row";
import { ThemedText } from "@/components/themed-text/themed-text";
import { estimateShippingJpy, FREE_SHIPPING_LINE_JPY } from "@/constants";
import { cartSubtotal, useCart } from "@/stores/cart";
import { colors, shadows, spacing } from "@/theme";
import { formatPrice } from "@/utils/format-price";
import { CartLine } from "./cart-line";

export function Cart() {
  const router = useRouter();
  const items = useCart((s) => s.items);
  const subtotal = cartSubtotal(items);
  const shipping = estimateShippingJpy(subtotal);

  if (items.length === 0) {
    return (
      <EmptyState
        title="カートは空です"
        detail="商品一覧からカートに追加してください"
      />
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={items}
        keyExtractor={(i) => String(i.productId)}
        contentContainerStyle={styles.content}
        renderItem={({ item }) => <CartLine item={item} />}
      />
      <View style={styles.footer}>
        <SummaryRow label="小計" value={formatPrice(subtotal)} />
        <SummaryRow
          label="送料"
          value={shipping === 0 ? "無料" : formatPrice(shipping)}
        />
        {shipping > 0 && (
          <ThemedText variant="caption">
            あと{formatPrice(FREE_SHIPPING_LINE_JPY - subtotal)}で送料無料
          </ThemedText>
        )}
        <SummaryRow label="合計" value={formatPrice(subtotal + shipping)} emphasis />
        <Button title="レジに進む" onPress={() => router.push("/checkout")} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: spacing.md,
  },
  footer: {
    padding: spacing.md,
    gap: spacing.sm,
    backgroundColor: colors.background,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.separator,
    boxShadow: shadows.card,
  },
});
