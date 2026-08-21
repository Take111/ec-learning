// タップ・無効状態の不透明度。Pressable の style 関数からはこの語彙だけを使う
// (0.3〜0.7 のマジックナンバーが画面ごとに散らばるのを防ぐ)
export const interaction = {
  pressed: 0.7,
  disabled: 0.4,
} as const;
