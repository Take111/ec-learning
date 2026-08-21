import { Pressable, StyleSheet } from "react-native";
import { Link } from "expo-router";
import { ProductListItem } from "@/api/types";
import { ProductImage } from "@/components/product-image/product-image";
import { ThemedText } from "@/components/themed-text/themed-text";
import { spacing } from "@/theme";
import { formatPrice } from "@/utils/format-price";

const CARD_IMAGE_SIZE = 160;

export function ProductCard({ product }: { product: ProductListItem }) {
  return (
    <Link href={{ pathname: "/products/[id]", params: { id: product.id } }} asChild>
      <Pressable style={({ pressed }) => [styles.card, pressed && { opacity: 0.7 }]}>
        <ProductImage productId={product.id} size={CARD_IMAGE_SIZE} style={styles.image} />
        <ThemedText variant="subhead" color="label" numberOfLines={2}>
          {product.name}
        </ThemedText>
        <ThemedText variant="headline">{formatPrice(product.price_jpy)}</ThemedText>
        {product.stock === 0 && (
          <ThemedText variant="caption" color="destructive">
            在庫切れ
          </ThemedText>
        )}
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  image: {
    width: "100%",
    aspectRatio: 1,
  },
});
