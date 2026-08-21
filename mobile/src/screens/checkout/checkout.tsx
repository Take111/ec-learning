import { useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import * as Crypto from "expo-crypto";
import { useMutation } from "@tanstack/react-query";
import { placeOrder } from "@/api/client";
import { Button } from "@/components/button/button";
import { SummaryRow } from "@/components/summary-row/summary-row";
import { ThemedText } from "@/components/themed-text/themed-text";
import { DEMO_ADDRESS, DEMO_ADDRESS_ID, estimateShippingJpy } from "@/constants";
import { cartSubtotal, useCart } from "@/stores/cart";
import { colors, radius, spacing } from "@/theme";
import { formatPrice } from "@/utils/format-price";

export function Checkout() {
  const router = useRouter();
  const items = useCart((s) => s.items);
  const clear = useCart((s) => s.clear);
  const subtotal = cartSubtotal(items);
  const shipping = estimateShippingJpy(subtotal);

  // 冪等キーは「この確定画面の1回の注文意図」につき1つ。
  // リトライ(C-4)では同じキーを使い回すことで二重注文を防ぐ — 画面表示時に採番する。
  // 前提: Hermes に global crypto は無いので expo-crypto を使う
  const [idempotencyKey] = useState(() => Crypto.randomUUID());

  const expectedTotal = subtotal + shipping;
  const mutation = useMutation({
    // リクエストは押下時に組み立てる(レンダー毎に構築する理由がない)
    mutationFn: () =>
      placeOrder(
        {
          address_id: DEMO_ADDRESS_ID,
          items: items.map((i) => ({ product_id: i.productId, quantity: i.quantity })),
          expected_total_jpy: expectedTotal,
        },
        idempotencyKey,
      ),
    onSuccess: () => {
      clear();
      // C-4 で注文完了画面・エラーダイアログを作り込む。C-2 は履歴タブへ戻すだけ
      router.dismissTo("/(tabs)/orders");
    },
  });

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Section title="配送先">
        <ThemedText variant="body">{DEMO_ADDRESS.name}</ThemedText>
        <ThemedText variant="subhead">
          〒{DEMO_ADDRESS.postalCode} {DEMO_ADDRESS.line}
        </ThemedText>
        <ThemedText variant="caption">
          デモユーザーの住所帳から(認証はスコープ外)
        </ThemedText>
      </Section>
      <Section title="注文内容">
        {items.map((i) => (
          <View key={i.productId} style={styles.line}>
            <ThemedText variant="subhead" color="label" numberOfLines={1} style={styles.lineName}>
              {i.name} × {i.quantity}
            </ThemedText>
            <ThemedText variant="body">{formatPrice(i.priceJpy * i.quantity)}</ThemedText>
          </View>
        ))}
      </Section>
      <Section title="支払い金額">
        <SummaryRow label="小計" value={formatPrice(subtotal)} />
        <SummaryRow label="送料" value={shipping === 0 ? "無料" : formatPrice(shipping)} />
        <SummaryRow label="合計" value={formatPrice(expectedTotal)} emphasis />
        <ThemedText variant="caption">
          金額はサーバーで最終確定されます。価格が改定されていた場合は確認画面を表示します
        </ThemedText>
      </Section>
      <Button
        title="注文を確定する"
        loading={mutation.isPending}
        disabled={items.length === 0}
        onPress={() => mutation.mutate()}
      />
    </ScrollView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <ThemedText variant="headline">{title}</ThemedText>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.md,
    gap: spacing.lg,
  },
  section: {
    gap: spacing.sm,
  },
  sectionBody: {
    gap: spacing.xs,
    backgroundColor: colors.secondaryBackground,
    borderRadius: radius.md,
    borderCurve: "continuous",
    padding: spacing.md,
  },
  line: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: spacing.sm,
  },
  lineName: {
    flex: 1,
  },
});
