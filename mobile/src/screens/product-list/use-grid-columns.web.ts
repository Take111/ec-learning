import { useWindowDimensions } from "react-native";
import { breakpoints } from "@/theme";

// web は画面幅から列数を算出する(リサイズに追従)。
// コンテンツ上限幅は contentWidth.wide なので、4列は上限幅でカード約240px になる計算
export function useGridColumns(): number {
  const { width } = useWindowDimensions();
  if (width >= breakpoints.lg) return 4;
  if (width >= breakpoints.md) return 3;
  return 2;
}
