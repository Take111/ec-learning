import { Pressable, StyleSheet, View } from "react-native";
import { ProductImage } from "@/components/product-image/product-image";
import { QuantityStepper } from "@/components/quantity-stepper/quantity-stepper";
import { ThemedText } from "@/components/themed-text/themed-text";
import { CartItem, useCart } from "@/stores/cart";
import { colors, interaction, spacing } from "@/theme";
import { formatPrice } from "@/utils/format-price";
import { isHovered } from "@/utils/pressable-hovered";

export function CartLine({ item }: { item: CartItem }) {
  const setQuantity = useCart((s) => s.setQuantity);
  const remove = useCart((s) => s.remove);

  return (
    <View style={styles.row}>
      <ProductImage productId={item.productId} size={72} />
      <View style={styles.info}>
        <ThemedText variant="subhead" color="label" numberOfLines={2}>
          {item.name}
        </ThemedText>
        <ThemedText variant="headline" tabular>
          {formatPrice(item.priceJpy)}
        </ThemedText>
        <View style={styles.controls}>
          <QuantityStepper
            value={item.quantity}
            max={item.stock}
            onChange={(next) => setQuantity(item.productId, next)}
          />
          <Pressable
            accessibilityRole="button"
            onPress={() => remove(item.productId)}
            hitSlop={12} // テキストリンクでも44pt相当のタッチターゲットを確保
            style={(state) => [
              { cursor: "pointer" as const },
              state.pressed
                ? { opacity: interaction.pressed }
                : isHovered(state) && { opacity: interaction.hovered },
            ]}
          >
            <ThemedText variant="subhead" color="destructive">
              削除
            </ThemedText>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.separator,
  },
  info: {
    flex: 1,
    gap: spacing.xs,
  },
  controls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: spacing.xs,
  },
});
