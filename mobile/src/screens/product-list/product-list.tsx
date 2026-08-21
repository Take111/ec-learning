import { useState } from "react";
import { ActivityIndicator, FlatList, StyleSheet, View } from "react-native";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { listCategories, listProducts } from "@/api/client";
import { EmptyState } from "@/components/empty-state/empty-state";
import { colors, spacing } from "@/theme";
import { CategoryChips } from "./category-chips";
import { ProductCard } from "./product-card";

export function ProductList() {
  const [parentId, setParentId] = useState<number | null>(null);
  const [childId, setChildId] = useState<number | null>(null);

  const categoriesQuery = useQuery({
    queryKey: ["categories"],
    queryFn: ({ signal }) => listCategories(signal),
    staleTime: Infinity, // カテゴリはマスタデータ。セッション中の再取得は不要
  });

  // 絞り込みは子カテゴリ選択時のみ(APIの契約)。大分類だけ選んだ状態は全商品を出す
  const categoryId = childId ?? undefined;
  const productsQuery = useInfiniteQuery({
    queryKey: ["products", categoryId],
    queryFn: ({ pageParam, signal }) =>
      listProducts({ categoryId, cursor: pageParam }, signal),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.next_cursor ?? undefined,
  });

  const products = productsQuery.data?.pages.flatMap((p) => p.products) ?? [];

  return (
    <View style={styles.container}>
      <CategoryChips
        categories={categoriesQuery.data?.categories ?? []}
        selectedParentId={parentId}
        selectedChildId={childId}
        onSelectParent={(id) => {
          setParentId(id);
          setChildId(null);
        }}
        onSelectChild={setChildId}
      />
      <FlatList
        data={products}
        keyExtractor={(p) => String(p.id)}
        numColumns={2}
        columnWrapperStyle={styles.column}
        contentContainerStyle={styles.content}
        renderItem={({ item }) => <ProductCard product={item} />}
        onEndReached={() => {
          if (productsQuery.hasNextPage && !productsQuery.isFetchingNextPage) {
            productsQuery.fetchNextPage();
          }
        }}
        onEndReachedThreshold={0.5}
        ListEmptyComponent={
          productsQuery.isLoading ? (
            <ActivityIndicator style={styles.loading} />
          ) : (
            <EmptyState title="商品が見つかりません" />
          )
        }
        ListFooterComponent={
          productsQuery.isFetchingNextPage ? <ActivityIndicator style={styles.loading} /> : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  column: {
    gap: spacing.md,
    paddingHorizontal: spacing.md,
  },
  content: {
    paddingBottom: spacing.xl,
  },
  loading: {
    padding: spacing.lg,
  },
});
