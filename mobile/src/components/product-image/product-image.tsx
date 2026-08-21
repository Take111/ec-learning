import { Image, ImageStyle } from "expo-image";
import { StyleProp } from "react-native";
import { colors, motion, radius } from "@/theme";
import { productImageUrl } from "@/utils/product-image";

// 商品画像の表示を1箇所に集約(一覧・詳細で使用)。
// 外部サービス(picsum)依存のため、読み込み中・オフライン時は
// secondaryBackground のプレースホルダにフォールバックする
// size は「取得解像度」の指定。表示サイズは style 側で上書きしてよい(width:"100%" 等)
export function ProductImage({
  productId,
  size,
  style,
}: {
  productId: number;
  size: number;
  style?: StyleProp<ImageStyle>;
}) {
  return (
    <Image
      source={{ uri: productImageUrl(productId, size * 2) }} // 2x でRetina対応
      style={[
        {
          width: size,
          height: size,
          borderRadius: radius.sm,
          backgroundColor: colors.secondaryBackground,
        },
        style,
      ]}
      contentFit="cover"
      transition={motion.fast} // フェードイン時間もモーショントークンで統一
      recyclingKey={String(productId)}
    />
  );
}
