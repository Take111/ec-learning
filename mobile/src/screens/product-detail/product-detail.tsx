import { useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { getProductDetail } from "@/api/client";
import { Button } from "@/components/button/button";
import { EmptyState } from "@/components/empty-state/empty-state";
import { ProductImage } from "@/components/product-image/product-image";
import { QuantityStepper } from "@/components/quantity-stepper/quantity-stepper";
import { ThemedText } from "@/components/themed-text/themed-text";
import { useCart } from "@/stores/cart";
import { colors, spacing } from "@/theme";
import { formatPrice } from "@/utils/format-price";

export function ProductDetail({ productId }: { productId: number }) {
  const [quantity, setQuantity] = useState(1);
  const add = useCart((s) => s.add);
  const inCart = useCart(
    (s) => s.items.find((i) => i.productId === productId)?.quantity ?? 0,
  );

  const query = useQuery({
    queryKey: ["product", productId],
    queryFn: () => getProductDetail(productId),
  });

  if (query.isLoading) {
    return <ActivityIndicator style={styles.center} />;
  }
  const product = query.data;
  if (!product) {
    return <EmptyState title="商品が見つかりません" />;
  }

  const soldOut = product.stock === 0;
  // カート内の数量と合わせて在庫を超えないよう、追加可能な残り数を上限にする
  const addableMax = Math.max(product.stock - inCart, 0);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <ProductImage productId={product.id} size={340} style={styles.image} />
      <View style={styles.body}>
        <ThemedText variant="title">{product.name}</ThemedText>
        <Rating avgRating={product.avg_rating} reviewCount={product.review_count} />
        <ThemedText variant="largeTitle">{formatPrice(product.price_jpy)}</ThemedText>
        {soldOut ? (
          <ThemedText variant="headline" color="destructive">
            在庫切れ
          </ThemedText>
        ) : (
          product.stock <= 5 && (
            <ThemedText variant="subhead" color="destructive">
              残り{product.stock}点
            </ThemedText>
          )
        )}
        {product.description && (
          <ThemedText variant="body" color="secondaryLabel">
            {product.description}
          </ThemedText>
        )}
        {!soldOut && (
          <View style={styles.cartRow}>
            <QuantityStepper
              value={quantity}
              max={Math.max(addableMax, 1)}
              onChange={setQuantity}
            />
            <Button
              title={inCart > 0 ? `カートに追加(${inCart}点入り)` : "カートに追加"}
              disabled={addableMax === 0}
              style={styles.addButton}
              onPress={() => {
                add(
                  {
                    productId: product.id,
                    name: product.name,
                    priceJpy: product.price_jpy,
                    stock: product.stock,
                  },
                  quantity,
                );
                setQuantity(1);
              }}
            />
          </View>
        )}
      </View>
    </ScrollView>
  );
}

function Rating({
  avgRating,
  reviewCount,
}: {
  avgRating: number | null;
  reviewCount: number;
}) {
  // avg_rating は「レビュー0件なら null」がAPI契約。0点と未評価を区別して表示する
  if (avgRating === null) {
    return <ThemedText variant="subhead">レビューはまだありません</ThemedText>;
  }
  return (
    <ThemedText variant="subhead">
      ★ {avgRating.toFixed(1)}({reviewCount}件のレビュー)
    </ThemedText>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingBottom: spacing.xxl,
  },
  center: {
    flex: 1,
  },
  image: {
    width: "100%",
    aspectRatio: 1,
    borderRadius: 0,
  },
  body: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  cartRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginTop: spacing.md,
  },
  addButton: {
    flex: 1,
  },
});
