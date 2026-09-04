import { useState } from "react";
import { Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Stack, useRouter } from "expo-router";
import * as Crypto from "expo-crypto";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { placeOrder } from "@/api/client";
import { Button } from "@/components/button/button";
import { SummaryRow } from "@/components/summary-row/summary-row";
import { ThemedText } from "@/components/themed-text/themed-text";
import { DEMO_ADDRESS, DEMO_ADDRESS_ID, estimateShippingJpy } from "@/constants";
import { useBottomInset } from "@/hooks/use-bottom-inset";
import { startOrderLiveActivity } from "@/live-activity/order-live-activity";
import { cartCount, cartSubtotal, useCart } from "@/stores/cart";
import { colors, contentWidth, interaction, spacing, surfaces } from "@/theme";
import { formatPrice } from "@/utils/format-price";
import { isHovered } from "@/utils/pressable-hovered";
import { OrderComplete } from "./order-complete";
import { showPlaceOrderError } from "./place-order-alerts";

export function Checkout() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const contentBottom = useBottomInset(spacing.md) + spacing.md;
  const items = useCart((s) => s.items);
  const clear = useCart((s) => s.clear);
  const subtotal = cartSubtotal(items);
  const shipping = estimateShippingJpy(subtotal);

  // 冪等キーは「この確定画面の1回の注文意図」につき1つ。
  // リトライ(通信失敗・価格改定の承諾後)では同じキーを使い回すことで
  // 二重注文をサーバーの UNIQUE 制約が吸収する。
  // 前提: Hermes に global crypto は無いので expo-crypto を使う
  const [idempotencyKey] = useState(() => Crypto.randomUUID());

  const expectedTotal = subtotal + shipping;
  const mutation = useMutation({
    // 価格改定(409)承諾後の再注文は、サーバーが返した現在合計を variables で
    // 上書きする(setState 経由だと Alert コールバック時点の closure が古い値を掴む)
    mutationFn: (vars?: { acceptedTotalJpy?: number }) =>
      placeOrder(
        {
          address_id: DEMO_ADDRESS_ID,
          items: items.map((i) => ({ product_id: i.productId, quantity: i.quantity })),
          expected_total_jpy: vars?.acceptedTotalJpy ?? expectedTotal,
        },
        idempotencyKey,
      ),
    onSuccess: (order) => {
      // Live Activity(iOS のみ・他は no-op)。点数は応答に無いので clear() の前にカートから取る。
      // 表示金額はサーバー確定値(OrderComplete と同じ原則)
      void startOrderLiveActivity({
        orderId: order.id,
        totalJpy: order.total_jpy,
        itemCount: cartCount(items),
      });
      clear();
      // アクティブなクエリは invalidate の瞬間にモーダル裏で refetch される
      // (タブ画面はマウントされたまま=アクティブ)。履歴タブに着いた時点で
      // 新注文が反映済みになるのはこの即時 refetch のおかげ
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["product"] });
    },
    onError: (error) =>
      showPlaceOrderError(error, {
        items,
        onAcceptNewTotal: (newTotalJpy) =>
          mutation.mutate({ acceptedTotalJpy: newTotalJpy }),
        onRetry: () => mutation.mutate(undefined),
        onBackToCart: () => router.back(),
      }),
  });

  // 成功後はモーダルの中身を完了ビューへ(キャンセル導線も消す)
  if (mutation.isSuccess) {
    return (
      <>
        <Stack.Screen options={{ title: "注文完了", headerLeft: () => null }} />
        <OrderComplete
          order={mutation.data}
          onClose={() => router.dismissTo("/orders")}
        />
      </>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={[styles.content, { paddingBottom: contentBottom }]}
    >
      {/* HIG: モーダルには明示的な離脱手段を置く(スワイプだけに頼らない)。
          送信中の離脱は禁止 — 離脱後に onSuccess/onError が走り、裏の画面に
          突然 Alert が出たりカートが無言で空になる事故を防ぐ */}
      <Stack.Screen
        options={{
          gestureEnabled: !mutation.isPending,
          headerLeft: () =>
            mutation.isPending ? null : (
              <Pressable
                accessibilityRole="button"
                onPress={() => router.back()}
                hitSlop={8}
                style={(state) => [
                  { cursor: "pointer" as const },
                  state.pressed
                    ? { opacity: interaction.pressed }
                    : isHovered(state) && { opacity: interaction.hovered },
                ]}
              >
                <ThemedText color="accent">キャンセル</ThemedText>
              </Pressable>
            ),
        }}
      />
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
            <ThemedText variant="body" tabular>
              {formatPrice(i.priceJpy * i.quantity)}
            </ThemedText>
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
        onPress={() => mutation.mutate(undefined)}
      />
    </ScrollView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <ThemedText variant="headline">{title}</ThemedText>
      <View style={[surfaces.card, styles.sectionBody]}>{children}</View>
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
    // web はフォーム系の読みやすい幅で中央寄せ(native では no-op)
    ...Platform.select({
      web: {
        width: "100%" as const,
        maxWidth: contentWidth.narrow,
        marginHorizontal: "auto" as const,
      },
    }),
  },
  section: {
    gap: spacing.sm,
  },
  sectionBody: {
    gap: spacing.xs,
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
