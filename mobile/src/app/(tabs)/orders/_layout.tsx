import { Stack } from "expo-router";

export default function OrdersStack() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: "注文履歴", headerLargeTitle: true }} />
    </Stack>
  );
}
