import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { cartCount, useCart } from "@/stores/cart";
import { colors } from "@/theme";

export default function TabsLayout() {
  const count = useCart((s) => cartCount(s.items));

  return (
    <Tabs screenOptions={{ tabBarActiveTintColor: colors.accent }}>
      <Tabs.Screen
        name="index"
        options={{
          title: "商品",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="storefront-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="cart"
        options={{
          title: "カート",
          tabBarBadge: count > 0 ? count : undefined,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="cart-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: "注文履歴",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="receipt-outline" color={color} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}
