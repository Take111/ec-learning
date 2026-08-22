// 前提: 認証はプロジェクトのスコープ外(学習対象はバックエンド)。
//   デモユーザーを固定し、住所も address_id で直接指定する。
//   認証を入れるならこのファイルごと消え、セッション由来の値に置き換わる
export const DEMO_USER_ID = 1;
export const DEMO_ADDRESS_ID = 1;

// DEMO_ADDRESS_ID=1 の実データ(user_addresses)の表示用複製。
// 氏名・住所は faker(jaロケール・シード固定)による架空データ(「南蒼市」は実在しない)。
// GET /addresses は無い(スコープ外)ため画面はこれを表示する — DB側を変えたらここも直す
export const DEMO_ADDRESS = {
  name: "三上 瑛太",
  postalCode: "624-4302",
  line: "神奈川県 南蒼市4丁目23-15",
} as const;

// 送料ルール(表示用)。金額の決定はサーバー側 — これはあくまでUI表示の複製であり、
// サーバーと食い違ったら 409 price_changed 側が正(API設計3原則)
export const FREE_SHIPPING_LINE_JPY = 5000;
export const SHIPPING_FEE_JPY = 550;

export function estimateShippingJpy(subtotalJpy: number): number {
  return subtotalJpy >= FREE_SHIPPING_LINE_JPY ? 0 : SHIPPING_FEE_JPY;
}
