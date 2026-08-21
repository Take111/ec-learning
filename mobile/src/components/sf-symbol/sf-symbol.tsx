import { ColorValue, StyleProp } from "react-native";
import { Image, ImageStyle } from "expo-image";

// SF Symbols を expo-image の sf: スキームで描画する共通部品(現在の利用は評価の星のみ。
// タブアイコンは NativeTabs.Trigger.Icon の sf/md プロップがフレームワーク側で解決する)。
// 前提: sf: スキームは iOS のみ — Android 対応時はこの1箇所を Platform 分岐にして
//   Material アイコン等へフォールバックする(呼び出し側は分岐を知らない)
export function SfSymbol({
  name,
  size,
  color,
  style,
}: {
  name: string;
  size: number;
  color: ColorValue;
  style?: StyleProp<ImageStyle>;
}) {
  return (
    <Image
      source={`sf:${name}`}
      style={[{ width: size, height: size }, style]}
      // expo-image の tintColor 型は string だが、ネイティブ側は PlatformColor も
      // processColor で解決できるためキャストで通す(型の嘘はこの1箇所に閉じる)
      tintColor={color as string}
      contentFit="contain"
    />
  );
}
