import { useCallback } from "react";
import { ActivityIndicator, FlatList, Platform, StyleSheet } from "react-native";
import { useFocusEffect } from "expo-router";
import { useInfiniteQuery } from "@tanstack/react-query";
import { listOrders } from "@/api/client";
import { EmptyState } from "@/components/empty-state/empty-state";
import { endOrderLiveActivities } from "@/live-activity/order-live-activity";
import { colors, contentWidth, spacing } from "@/theme";
import { OrderRow } from "./order-row";

// GET /orders のカーソルページネーション(ADR 006)をUIで実演する画面。
// useInfiniteQuery の pageParam に next_cursor をそのまま流す
export function OrderHistory() {
  const query = useInfiniteQuery({
    queryKey: ["orders"],
    queryFn: ({ pageParam, signal }) => listOrders({ cursor: pageParam }, signal),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.next_cursor ?? undefined,
  });

  const orders = query.data?.pages.flatMap((p) => p.orders) ?? [];

  // 履歴を開いた = 注文を確認したとみなし、注文の Live Activity を終える(iOS 以外は no-op)。
  // Live Activity のタップ先(eclearning://orders)もここに着地するので、タップで開いても同じ導線になる
  useFocusEffect(
    useCallback(() => {
      void endOrderLiveActivities();
    }, []),
  );

  return (
    <FlatList
      style={styles.list}
      contentInsetAdjustmentBehavior="automatic"
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
    // web は明細の読みやすい幅で中央寄せ(native では no-op)
    ...Platform.select({
      web: {
        width: "100%" as const,
        maxWidth: contentWidth.narrow,
        marginHorizontal: "auto" as const,
      },
    }),
  },
  loading: {
    padding: spacing.lg,
  },
});
