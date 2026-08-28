import { NativeTabs } from "expo-router/unstable-native-tabs";
import { cartCount, useCart } from "@/stores/cart";

// JSタブ(react-navigation)ではなく本物の UITabBarController。
// iOS 26 では Liquid Glass 外観とスクロール時の最小化が無償で付く。
// web は同居の _layout.web.tsx(ヘッドレスタブ + SiteHeader)に分岐する。
// 前提: NativeTabs はヘッダーを描画しない — 各タブ配下の Stack がヘッダーを担う。
//   トリガーは静的であること(動的な増減はナビゲータごと再マウントされ状態が飛ぶ)
export default function TabsLayout() {
  const count = useCart((s) => cartCount(s.items));

  return (
    <NativeTabs minimizeBehavior="onScrollDown">
      <NativeTabs.Trigger name="(home)">
        <NativeTabs.Trigger.Icon sf="storefront" md="storefront" />
        <NativeTabs.Trigger.Label>商品</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="cart">
        <NativeTabs.Trigger.Icon sf="cart" md="shopping_cart" />
        <NativeTabs.Trigger.Label>カート</NativeTabs.Trigger.Label>
        {/* Badge はトリガー児だが screen options に変換されるだけなので、
            条件レンダリングでも再マウントは起きない(静的制約はトリガー自体の話)。
            hidden プロップは children 非空だと無視されるため、この形が唯一の正解 */}
        {count > 0 && (
          <NativeTabs.Trigger.Badge>{String(count)}</NativeTabs.Trigger.Badge>
        )}
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="orders">
        <NativeTabs.Trigger.Icon sf="receipt" md="receipt_long" />
        <NativeTabs.Trigger.Label>注文履歴</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
