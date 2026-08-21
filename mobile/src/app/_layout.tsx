import { useColorScheme } from "react-native";
import { Stack } from "expo-router";
import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "expo-router/react-navigation";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// QueryClient はアプリで1つ(モジュールスコープ生成。コンポーネント内で作ると
// 再レンダーでキャッシュごと破棄される)
const queryClient = new QueryClient();

export default function RootLayout() {
  // ナビゲーション chrome(ヘッダー・タブバー・シーン背景)は react-navigation の
  // テーマで配色される。ThemeProvider を張らないと DefaultTheme(ライト固定)に
  // なり、セマンティックカラーで組んだ画面本体とダークモードで乖離する
  const scheme = useColorScheme();
  return (
    <ThemeProvider value={scheme === "dark" ? DarkTheme : DefaultTheme}>
      <QueryClientProvider client={queryClient}>
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen
            name="products/[id]"
            // 戻るボタンにタブグループ名 "(tabs)" が出るのを避け、シェブロンのみにする
            options={{ title: "商品詳細", headerBackButtonDisplayMode: "minimal" }}
          />
          <Stack.Screen
            name="checkout"
            options={{ title: "注文の確認", presentation: "modal" }}
          />
        </Stack>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
