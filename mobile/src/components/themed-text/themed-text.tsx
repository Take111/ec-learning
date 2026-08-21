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
  style,
  ...props
}: TextProps & {
  variant?: keyof typeof type;
  color?: keyof typeof colors;
}) {
  return (
    <Text
      style={[type[variant], { color: colors[color ?? defaultColor[variant]] }, style]}
      {...props}
    />
  );
}
