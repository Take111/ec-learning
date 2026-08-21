import { useSafeAreaInsets } from "react-native-safe-area-context";

// タブバーの無い画面(スタック詳細・モーダル)専用の下端インセット。
// タブ配下の画面はタブバー自体がホームインジケータ分を吸収するため不要。
// min はインセット0の端末(ホームボタン機)でも最低限確保する余白
export function useBottomInset(min: number): number {
  const insets = useSafeAreaInsets();
  return Math.max(insets.bottom, min);
}
