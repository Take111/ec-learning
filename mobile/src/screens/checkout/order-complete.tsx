import { StyleSheet, View } from "react-native";
import { PlaceOrderResponse } from "@/api/types";
import { Button } from "@/components/button/button";
import { SfSymbol } from "@/components/sf-symbol/sf-symbol";
import { SummaryRow } from "@/components/summary-row/summary-row";
import { ThemedText } from "@/components/themed-text/themed-text";
import { colors, spacing, surfaces } from "@/theme";
import { formatPrice } from "@/utils/format-price";
import { orderStatusLabel } from "@/utils/order-status";

// 注文成功後にチェックアウトモーダルの中身を置き換える完了ビュー。
// 表示する金額はすべてサーバー応答の確定値(クライアント計算値は使わない)
export function OrderComplete({
  order,
  onClose,
}: {
  order: PlaceOrderResponse;
  onClose: () => void;
}) {
  return (
    <View style={styles.container}>
      <SfSymbol name="checkmark.circle.fill" size={56} color={colors.success} />
      <ThemedText variant="title">ご注文ありがとうございます</ThemedText>
      {/* 注文番号は問い合わせで使う実データなのでコピー可能にする */}
      <ThemedText variant="subhead" selectable>
        注文番号 {order.id}
      </ThemedText>
      <View style={[surfaces.card, styles.summary]}>
        <SummaryRow
          label="送料"
          value={order.shipping_fee_jpy === 0 ? "無料" : formatPrice(order.shipping_fee_jpy)}
        />
        <SummaryRow label="合計" value={formatPrice(order.total_jpy)} emphasis />
        <ThemedText variant="caption">
          ステータス: {orderStatusLabel[order.status]}
        </ThemedText>
      </View>
      <Button title="注文履歴を見る" onPress={onClose} style={styles.button} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.md,
    padding: spacing.lg,
    backgroundColor: colors.background,
  },
  summary: {
    alignSelf: "stretch",
    gap: spacing.sm,
  },
  button: {
    alignSelf: "stretch",
    marginTop: spacing.md,
  },
});
