import { Alert } from "react-native";
import { DialogSpec } from "./dialog-spec";

// ネイティブは OS の Alert をそのまま使う(C-4 の決定: プラットフォーム標準の
// ダイアログが最も信頼される)。web 実装は同居の present-dialog.web.ts
export function presentDialog(spec: DialogSpec) {
  Alert.alert(spec.title, spec.message, spec.buttons);
}
