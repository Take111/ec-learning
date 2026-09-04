import { Pressable, StyleSheet, View } from "react-native";
import { Link } from "expo-router";
import Animated, { FadeInUp } from "react-native-reanimated";
import { ProductListItem } from "@/api/types";
import { ProductImage } from "@/components/product-image/product-image";
import { ThemedText } from "@/components/themed-text/themed-text";
import { interaction, motion, radius, spacing } from "@/theme";
import { formatPrice } from "@/utils/format-price";
import { isHovered } from "@/utils/pressable-hovered";

const CARD_IMAGE_SIZE = 160;

export function ProductCard({
  product,
  index,
  columns,
}: {
  product: ProductListItem;
  index: number;
  /** 親グリッドの列数(native は2固定、web は幅に応じて可変)。maxWidth の算出用 */
  columns: number;
}) {
  return (
    // グリッドの staggered fade-in はアプリ唯一のモーションの見せ場
    // (delay は行単位で頭打ちにし、追加読み込みページでも間延びさせない)
    <Animated.View
      entering={FadeInUp.duration(motion.base).delay(Math.min(index % 10, 6) * 40)}
      // 最終行が列数未満のとき、flex:1 だけだと行幅全部に伸びてしまう。
      // 1列分の幅で頭打ちにして端数行のカード幅を保つ
      style={[styles.card, { maxWidth: `${100 / columns}%` }]}
    >
      <Link href={{ pathname: "/products/[id]", params: { id: product.id } }} asChild>
        <Pressable
          style={(state) => [
            styles.pressable,
            state.pressed
              ? { opacity: interaction.pressed }
              : isHovered(state) && { opacity: interaction.hovered },
          ]}
        >
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
    marginBottom: spacing.md,
  },
  pressable: {
    cursor: "pointer",
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
