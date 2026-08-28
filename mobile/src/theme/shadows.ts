// boxShadow 文字列のみ(旧 shadow*/elevation プロップは使わない)。
// 前提: ダークモードでは黒影がほぼ見えないため、影は輪郭の主役にしない
// (併用する hairline の separator が輪郭を担う)。
// ダイアログ: ネイティブは OS の Alert(C-4 の決定)のままだが、web 対応で
// モーダルを自前描画することになり、overlay 級の影がここに復活した(前提の変化)
export const shadows = {
  raised: "0 4px 12px rgba(0, 0, 0, 0.10)",
  // web ダイアログ専用。web はライト固定(colors の v1 スコープ)なので濃度は固定値でよい
  overlay: "0 24px 64px rgba(0, 0, 0, 0.22)",
} as const;
