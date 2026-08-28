// タップ・無効状態の不透明度。Pressable の style 関数からはこの語彙だけを使う
// (0.3〜0.7 のマジックナンバーが画面ごとに散らばるのを防ぐ)
export const interaction = {
  pressed: 0.7,
  // web のホバー(pressed より弱い「押せる予告」)。ネイティブでは発生しない —
  // 状態の取り出しは utils/pressable-hovered の isHovered 経由で統一する
  hovered: 0.85,
  disabled: 0.4,
} as const;
