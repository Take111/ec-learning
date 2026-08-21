import { TextStyle } from "react-native";

// Apple のテキストランプに揃えた名前付きスタイル。画面から fontSize を直接触らない
// (適用は components/themed-text 経由)。
// 前提: サイズ軸と色軸は分離する — 色は ThemedText の color プロップ(セマンティック名)で
//   指定する。ここに color を焼き込むと、利用側がインライン style で色を打ち消す穴が生まれる
export const type = {
  largeTitle: { fontSize: 34, fontWeight: "700" },
  title: { fontSize: 22, fontWeight: "600" },
  headline: { fontSize: 17, fontWeight: "600" },
  body: { fontSize: 17, fontWeight: "400" },
  subhead: { fontSize: 15, fontWeight: "400" },
  caption: { fontSize: 12, fontWeight: "400" },
} as const satisfies Record<string, TextStyle>;
