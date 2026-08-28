import { Platform } from "react-native";
import { Stack } from "expo-router";

export default function CartStack() {
  return (
    <Stack>
      {/* カートは件数が少なく作業画面の性格が強いので largeTitle は使わない(home/orders と意図的に非対称)。
          web で headerShown を切る理由は (home)/_layout 参照 */}
      <Stack.Screen name="index" options={{ title: "カート", headerShown: Platform.OS !== "web" }} />
    </Stack>
  );
}
