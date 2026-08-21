import { Stack } from "expo-router";

export default function CartStack() {
  return (
    <Stack>
      {/* カートは件数が少なく作業画面の性格が強いので largeTitle は使わない(home/orders と意図的に非対称) */}
      <Stack.Screen name="index" options={{ title: "カート" }} />
    </Stack>
  );
}
