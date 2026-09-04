import { useColorScheme } from "react-native";
import { Stack } from "expo-router";
import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "expo-router/react-navigation";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AppDialogHost } from "@/components/app-dialog/app-dialog-host";
import { SiteHeader } from "@/components/site-header/site-header";
import { useOrderLiveActivityLifecycle } from "@/live-activity/order-live-activity";

// QueryClient はアプリで1つ(モジュールスコープ生成。コンポーネント内で作ると
// 再レンダーでキャッシュごと破棄される)
const queryClient = new QueryClient();

export default function RootLayout() {
  // ナビゲーション chrome(ヘッダー・タブバー・シーン背景)は react-navigation の
  // テーマで配色される。ThemeProvider を張らないと DefaultTheme(ライト固定)に
  // なり、セマンティックカラーで組んだ画面本体とダークモードで乖離する
  const scheme = useColorScheme();
  // 注文 Live Activity の起動時掃除と復帰時の追いつき(iOS 以外は no-op)
  useOrderLiveActivityLifecycle();
  return (
    <ThemeProvider value={scheme === "dark" ? DarkTheme : DefaultTheme}>
      <QueryClientProvider client={queryClient}>
        {/* web のみ描画される持続ヘッダー(native は null)。詳細・チェックアウトは
            タブ外のルート Stack 画面なので、サイトの chrome を消さないためにここに置く */}
        <SiteHeader />
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen
            name="products/[id]"
            // 詳細はルートStackのpush = タブバー非表示(Apple Store アプリと同じ作法)。
            // フルスクリーンで商品に集中させ、sticky CTA フッターを成立させる意図。
            // タブバー維持に変えるなら (home,cart,orders)/products/[id] の共有グループ化と
            // CTA のスクロール内容化が必要(カートで同じ対処をした)。
            // 戻るボタンはタブグループ名 "(tabs)" が出るのを避けシェブロンのみにする
            options={{ title: "商品詳細", headerBackButtonDisplayMode: "minimal" }}
          />
          <Stack.Screen
            name="checkout"
            options={{ title: "注文の確認", presentation: "modal" }}
          />
        </Stack>
        {/* web のみ: Alert 代替モーダルの描画先(native は null)。オーバーレイが
            画面全体を覆えるよう、ナビゲータの後(最前面)に置く */}
        <AppDialogHost />
      </QueryClientProvider>
    </ThemeProvider>
  );
}
