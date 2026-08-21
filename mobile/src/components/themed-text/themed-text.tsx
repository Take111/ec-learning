import { Text, TextProps } from "react-native";
import { colors, type } from "@/theme";

// バリアントごとの既定色(補助テキスト系は secondaryLabel)。color プロップで上書き可能
const defaultColor: Record<keyof typeof type, keyof typeof colors> = {
  largeTitle: "label",
  title: "label",
  headline: "label",
  body: "label",
  subhead: "secondaryLabel",
  caption: "secondaryLabel",
};

export function ThemedText({
  variant = "body",
  color,
  tabular,
  style,
  ...props
}: TextProps & {
  variant?: keyof typeof type;
  color?: keyof typeof colors;
  /** 金額・カウンタなど桁が動く数値に指定(等幅数字で揃える) */
  tabular?: boolean;
}) {
  return (
    <Text
      style={[
        type[variant],
        { color: colors[color ?? defaultColor[variant]] },
        tabular && { fontVariant: ["tabular-nums" as const] },
        style,
      ]}
      {...props}
    />
  );
}
