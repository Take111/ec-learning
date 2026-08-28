import { Platform } from "react-native";
import { Stack } from "expo-router";

export default function OrdersStack() {
  return (
    <Stack>
      {/* web で headerShown を切る理由は (home)/_layout 参照 */}
      <Stack.Screen
        name="index"
        options={{ title: "注文履歴", headerLargeTitle: true, headerShown: Platform.OS !== "web" }}
      />
    </Stack>
  );
}
