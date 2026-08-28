import { StyleSheet } from "react-native";
import { TabList, TabSlot, TabTrigger, Tabs } from "expo-router/ui";

// web は NativeTabs(_layout.tsx)ではなくヘッドレスタブに分岐する。
// タブバーはここでは描画しない — ナビゲーションはルートレイアウトの SiteHeader(web)が
// 担い、この層は「3タブのルート宣言 + 表示中タブの切り替え」だけを提供する。
// ヘッドレスタブ(Slot 置き換えではなく)を使う理由: タブを跨いでも各タブの
// マウント状態が保持される — 一覧の無限スクロール位置がカートを見た後も残る
export default function TabsLayout() {
  return (
    <Tabs>
      <TabSlot />
      <TabList style={styles.hiddenTabList}>
        <TabTrigger name="(home)" href="/" />
        <TabTrigger name="cart" href="/cart" />
        <TabTrigger name="orders" href="/orders" />
      </TabList>
    </Tabs>
  );
}

const styles = StyleSheet.create({
  // トリガーはルート宣言のためだけに必要(表示は SiteHeader の仕事)
  hiddenTabList: {
    display: "none",
  },
});
