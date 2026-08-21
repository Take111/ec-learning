import { Stack } from "expo-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// QueryClient はアプリで1つ(モジュールスコープ生成。コンポーネント内で作ると
// 再レンダーでキャッシュごと破棄される)
const queryClient = new QueryClient();

export default function RootLayout() {
  return (
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
  );
}
