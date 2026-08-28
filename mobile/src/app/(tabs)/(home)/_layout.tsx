import { Platform } from "react-native";
import { Stack } from "expo-router";

export default function HomeStack() {
  return (
    <Stack>
      <Stack.Screen
        name="index"
        // web は SiteHeader が現在地を示すため、画面内ヘッダーは重複 chrome になる。
        // タブ直下の3画面だけ非表示にする(詳細・チェックアウトのヘッダーは
        // 戻る/キャンセル導線として web でも残す)
        options={{ title: "商品", headerLargeTitle: true, headerShown: Platform.OS !== "web" }}
      />
    </Stack>
  );
}
