import { useLocalSearchParams } from "expo-router";
import { ProductDetail } from "@/screens/product-detail/product-detail";

export default function ProductDetailRoute() {
  // ルートはURLパラメータの解釈だけを担い、画面本体は screens 側に置く(責務分離)
  const { id } = useLocalSearchParams<{ id: string }>();
  return <ProductDetail productId={Number(id)} />;
}
