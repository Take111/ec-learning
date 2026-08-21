import { ActivityIndicator, FlatList, StyleSheet } from "react-native";
import { useInfiniteQuery } from "@tanstack/react-query";
import { listOrders } from "@/api/client";
import { EmptyState } from "@/components/empty-state/empty-state";
import { colors, spacing } from "@/theme";
import { OrderRow } from "./order-row";

// GET /orders のカーソルページネーション(ADR 006)をUIで実演する画面。
// useInfiniteQuery の pageParam に next_cursor をそのまま流す
export function OrderHistory() {
  const query = useInfiniteQuery({
    queryKey: ["orders"],
    queryFn: ({ pageParam }) => listOrders({ cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.next_cursor ?? undefined,
  });

  const orders = query.data?.pages.flatMap((p) => p.orders) ?? [];

  return (
    <FlatList
      style={styles.list}
      data={orders}
      keyExtractor={(o) => String(o.id)}
      contentContainerStyle={styles.content}
      renderItem={({ item }) => <OrderRow order={item} />}
      onEndReached={() => {
        if (query.hasNextPage && !query.isFetchingNextPage) {
          query.fetchNextPage();
        }
      }}
      onEndReachedThreshold={0.5}
      ListEmptyComponent={
        query.isLoading ? (
          <ActivityIndicator style={styles.loading} />
        ) : (
          <EmptyState title="注文履歴はまだありません" />
        )
      }
      ListFooterComponent={
        query.isFetchingNextPage ? <ActivityIndicator style={styles.loading} /> : null
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
    flexGrow: 1,
  },
  loading: {
    padding: spacing.lg,
  },
});
