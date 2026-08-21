import { StyleSheet, View } from "react-native";
import { OrderSummary } from "@/api/types";
import { ThemedText } from "@/components/themed-text/themed-text";
import { colors, radius, spacing } from "@/theme";
import { formatDate } from "@/utils/format-date";
import { formatPrice } from "@/utils/format-price";
import { orderStatusColor, orderStatusLabel } from "@/utils/order-status";

export function OrderRow({ order }: { order: OrderSummary }) {
  return (
    <View style={styles.row}>
      <View style={styles.header}>
        {/* 注文番号は問い合わせで使う実データなのでコピー可能にする */}
        <ThemedText variant="caption" selectable>
          {formatDate(order.ordered_at)} ・ 注文番号 {order.id}
        </ThemedText>
        <View style={styles.badge}>
          <ThemedText variant="caption" color={orderStatusColor[order.status]}>
            {orderStatusLabel[order.status]}
          </ThemedText>
        </View>
      </View>
      <View style={styles.body}>
        <ThemedText variant="headline" tabular>
          {formatPrice(order.total_jpy)}
        </ThemedText>
        <ThemedText variant="caption">
          {order.shipping_fee_jpy === 0
            ? "送料無料"
            : `送料 ${formatPrice(order.shipping_fee_jpy)} を含む`}
        </ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    gap: spacing.xs,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.separator,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: spacing.sm,
  },
  body: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    backgroundColor: colors.secondaryBackground,
  },
});
