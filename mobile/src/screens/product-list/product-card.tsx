import { Pressable, StyleSheet, View } from "react-native";
import { Link } from "expo-router";
import Animated, { FadeInUp } from "react-native-reanimated";
import { ProductListItem } from "@/api/types";
import { ProductImage } from "@/components/product-image/product-image";
import { ThemedText } from "@/components/themed-text/themed-text";
import { interaction, motion, radius, spacing } from "@/theme";
import { formatPrice } from "@/utils/format-price";

const CARD_IMAGE_SIZE = 160;

export function ProductCard({ product, index }: { product: ProductListItem; index: number }) {
  return (
    // グリッドの staggered fade-in はアプリ唯一のモーションの見せ場
    // (delay は行単位で頭打ちにし、追加読み込みページでも間延びさせない)
    <Animated.View
      entering={FadeInUp.duration(motion.base).delay(Math.min(index % 10, 6) * 40)}
      style={styles.card}
    >
      <Link href={{ pathname: "/products/[id]", params: { id: product.id } }} asChild>
        <Pressable style={({ pressed }) => pressed && { opacity: interaction.pressed }}>
          <View>
            <ProductImage productId={product.id} size={CARD_IMAGE_SIZE} style={styles.image} />
            {product.stock === 0 && (
              <View style={styles.soldOutBadge}>
                {/* スクリム上の白は onAccent を流用(両モード白固定という同じ性質) */}
                <ThemedText variant="caption" color="onAccent">
                  在庫切れ
                </ThemedText>
              </View>
            )}
          </View>
          <ThemedText variant="subhead" color="label" numberOfLines={2} style={styles.name}>
            {product.name}
          </ThemedText>
          <ThemedText variant="headline" tabular>
            {formatPrice(product.price_jpy)}
          </ThemedText>
        </Pressable>
      </Link>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    // numColumns=2 の最終行が1件(奇数件)のとき、flex:1 だけだと行幅全部に
    // 伸びてしまう。50% で頭打ちにして片側カードの幅を保つ
    maxWidth: "50%",
    marginBottom: spacing.md,
  },
  image: {
    width: "100%",
    aspectRatio: 1,
  },
  name: {
    marginTop: spacing.xs,
    marginBottom: spacing.xs,
  },
  // 写真の上に載るスクリムはテーマ非依存(背景が写真なので固定の黒半透明+白文字)
  soldOutBadge: {
    position: "absolute",
    bottom: spacing.sm,
    left: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    backgroundColor: "rgba(0, 0, 0, 0.55)",
  },
});
