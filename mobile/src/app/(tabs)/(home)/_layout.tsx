import { Stack } from "expo-router";

export default function HomeStack() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: "商品", headerLargeTitle: true }} />
    </Stack>
  );
}
