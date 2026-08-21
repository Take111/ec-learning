// boxShadow 文字列のみ(旧 shadow*/elevation プロップは使わない)。
// 前提: ダークモードでは黒影がほぼ見えないため、影は輪郭の主役にしない
// (併用する hairline の separator が輪郭を担う)。
// ダイアログはネイティブ Alert を使う決定(C-4)をしたため、overlay 級の影は不要になった
export const shadows = {
  raised: "0 4px 12px rgba(0, 0, 0, 0.10)",
} as const;
