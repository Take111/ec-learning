import { ColorValue, StyleProp, TextStyle } from "react-native";
import { ImageStyle } from "expo-image";
import { MaterialIcons } from "@expo/vector-icons";

// web では expo-image の sf: スキームが描画できない(SF Symbols は Apple プラットフォーム
// のフォント資産)ため、Material アイコンへ写像する。
// 対応表は使う記号が増えたときにだけ足す — 未知の名前は落とさず null を返し、
// 開発中に「アイコンが消えている」ことで気づける形にする
const sfToMaterial: Record<string, keyof typeof MaterialIcons.glyphMap> = {
  "star.fill": "star",
};

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
  const mapped = sfToMaterial[name];
  if (!mapped) return null;
  return (
    <MaterialIcons
      name={mapped}
      size={size}
      color={color as string}
      // アイコンは Text 描画だが、呼び出し側の契約(ImageStyle)は native 版に合わせて
      // 維持する。型の嘘はこの1箇所に閉じる(native 版の tintColor と同じ方針)
      style={style as StyleProp<TextStyle>}
    />
  );
}
