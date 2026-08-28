import { FlatList, Platform, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { Button } from "@/components/button/button";
import { EmptyState } from "@/components/empty-state/empty-state";
import { SummaryRow } from "@/components/summary-row/summary-row";
import { ThemedText } from "@/components/themed-text/themed-text";
import { estimateShippingJpy, FREE_SHIPPING_LINE_JPY } from "@/constants";
import { cartSubtotal, useCart } from "@/stores/cart";
import { colors, contentWidth, spacing, surfaces } from "@/theme";
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

  // サマリー+CTA は固定フッターではなくスクロール内容に置く。
  // 前提: Liquid Glass の浮遊タブバー(NativeTabs)は画面下に被さるため、
  //   固定フッターだと CTA が埋まる。スクロール内容なら自動インセットが
  //   タブバー分の逃げを確保する(タブバー高さはAPIで取得できない)
  return (
    <FlatList
      style={styles.list}
      contentInsetAdjustmentBehavior="automatic"
      data={items}
      keyExtractor={(i) => String(i.productId)}
      contentContainerStyle={styles.content}
      renderItem={({ item }) => <CartLine item={item} />}
      ListFooterComponent={
        <View style={[surfaces.card, styles.summary]}>
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
      }
    />
  );
}

const styles = StyleSheet.create({
  list: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: spacing.md,
    // web は明細の読みやすい幅で中央寄せ(native では no-op)
    ...Platform.select({
      web: {
        width: "100%" as const,
        maxWidth: contentWidth.narrow,
        marginHorizontal: "auto" as const,
      },
    }),
  },
  summary: {
    gap: spacing.sm,
    marginTop: spacing.md,
  },
});
