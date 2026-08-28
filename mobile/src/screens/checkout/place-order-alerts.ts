import { presentDialog } from "@/components/app-dialog/present-dialog";
import { ApiError } from "@/api/errors";
import { CartItem } from "@/stores/cart";
import { formatPrice } from "@/utils/format-price";

// POST /orders のエラー → ダイアログ対応表。
// サーバー側 handler の「エラー→HTTPステータス対応表」と対をなすクライアント側の半分。
// このモジュールは表示だけを知り、リトライ等の動作は呼び出し側から注入される。
// 提示手段は presentDialog に委譲(native = OS Alert / web = モーダル)— 対応表は
// プラットフォーム非依存にここ1本で維持する
export function showPlaceOrderError(
  error: unknown,
  ctx: {
    items: CartItem[];
    /** 価格改定をユーザーが承諾 → 新しい合計で再注文 */
    onAcceptNewTotal: (newTotalJpy: number) => void;
    /** 通信失敗 → 同じ冪等キーで再試行 */
    onRetry: () => void;
    /** 在庫不足 → カートに戻して数量調整してもらう */
    onBackToCart: () => void;
  },
) {
  if (!(error instanceof ApiError)) {
    presentDialog({
      title: "注文に失敗しました",
      message: "時間をおいて再度お試しください。",
    });
    return;
  }
  switch (error.body.error) {
    case "price_changed": {
      // サーバーが決定した現在の合計(API設計原則: 金額はサーバーが決める)。
      // クライアント表示は検知用の expected でしかない
      const next = error.body.actual_total_jpy;
      const shown = error.body.expected_total_jpy;
      if (next == null || shown == null) break; // 契約外ボディ → 汎用アラートへ
      presentDialog({
        title: "価格が改定されています",
        message:
          `ご確認中に商品の価格が変わりました。\n` +
          `表示していた合計: ${formatPrice(shown)}\n` +
          `現在の合計: ${formatPrice(next)}`,
        buttons: [
          { text: "キャンセル", style: "cancel" },
          { text: "新しい金額で注文", onPress: () => ctx.onAcceptNewTotal(next) },
        ],
      });
      return;
    }
    case "insufficient_stock": {
      const name =
        ctx.items.find((i) => i.productId === error.body.product_id)?.name ?? "商品";
      presentDialog({
        title: "在庫が不足しています",
        message: `「${name}」の在庫が注文数量に足りませんでした。\nカートで数量を調整してください。`,
        buttons: [{ text: "カートに戻る", onPress: ctx.onBackToCart }],
      });
      return;
    }
    case "network_error":
      presentDialog({
        title: "通信に失敗しました",
        message:
          "注文がサーバーに届いたかどうかに関わらず、同じ注文キーで安全に再試行できます" +
          "(サーバー側の冪等処理により二重注文にはなりません)。",
        buttons: [
          { text: "閉じる", style: "cancel" },
          { text: "再試行", onPress: () => ctx.onRetry() },
        ],
      });
      return;
    case "invalid_address":
      presentDialog({
        title: "配送先を確認できませんでした",
        message: "配送先住所が見つかりません。",
      });
      return;
    default:
      break; // 未知コードは switch 後の汎用アラートへ
  }
  presentDialog({
    title: "注文に失敗しました",
    message: `エラーコード: ${error.body.error}`,
  });
}
