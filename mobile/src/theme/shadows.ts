// boxShadow 文字列のみ(旧 shadow*/elevation プロップは使わない)。
// 前提: ダークモードでは黒影がほぼ見えないため、影は輪郭の主役にしない
// (併用する hairline の separator が輪郭を担う)
export const shadows = {
  raised: "0 4px 12px rgba(0, 0, 0, 0.10)",
  // overlay は現在未使用 — C-4 のダイアログ/シートで使う予定のため温存
  overlay: "0 8px 24px rgba(0, 0, 0, 0.18)",
} as const;
