import { useState } from "react";
import { ActivityIndicator, FlatList, Platform, StyleSheet } from "react-native";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { listCategories, listProducts } from "@/api/client";
import { EmptyState } from "@/components/empty-state/empty-state";
import { colors, contentWidth, spacing } from "@/theme";
import { CategoryChips } from "./category-chips";
import { ProductCard } from "./product-card";
import { useGridColumns } from "./use-grid-columns";

export function ProductList() {
  const [parentId, setParentId] = useState<number | null>(null);
  const [childId, setChildId] = useState<number | null>(null);
  const numColumns = useGridColumns();

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

  // FlatList を画面の最初の子にする(Liquid Glass のスクロールエッジ効果・
  // ラージタイトルの折りたたみ・タブバー最小化がスクロールに追従する条件)。
  // チップは ListHeaderComponent としてリスト内に置く
  return (
    <FlatList
      style={styles.list}
      contentInsetAdjustmentBehavior="automatic"
      data={products}
      keyExtractor={(p) => String(p.id)}
      // FlatList は numColumns の動的変更を許さないため key で再マウントする。
      // 発生するのは web のブレークポイント跨ぎのみ(スクロール位置が飛ぶのは許容)
      key={numColumns}
      numColumns={numColumns}
      columnWrapperStyle={styles.column}
      contentContainerStyle={styles.content}
      ListHeaderComponent={
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
      }
      renderItem={({ item, index }) => (
        <ProductCard product={item} index={index} columns={numColumns} />
      )}
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
  );
}

const styles = StyleSheet.create({
  list: {
    flex: 1,
    backgroundColor: colors.background,
  },
  column: {
    gap: spacing.md,
    paddingHorizontal: spacing.md,
  },
  content: {
    paddingBottom: spacing.xl,
    // web はグリッド上限幅で中央寄せ(native では no-op)
    ...Platform.select({
      web: {
        width: "100%" as const,
        maxWidth: contentWidth.wide,
        marginHorizontal: "auto" as const,
      },
    }),
  },
  loading: {
    padding: spacing.lg,
  },
});
