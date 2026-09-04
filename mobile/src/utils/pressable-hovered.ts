import { PressableStateCallbackType } from "react-native";

// react-native-web は Pressable の style/children 関数に hovered / focused も渡すが、
// RN コアの型定義には pressed しか無い。web 専用状態への型の嘘をこの1箇所に閉じる
// (sf-symbol の tintColor キャストと同じ方針)。ネイティブでは常に false
export function isHovered(state: PressableStateCallbackType): boolean {
  return (state as { hovered?: boolean }).hovered === true;
}
