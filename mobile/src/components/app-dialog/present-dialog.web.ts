import { create } from "zustand";
import { DialogSpec } from "./dialog-spec";

// react-native-web の Alert.alert はボタン付きダイアログを描画しない(無言の no-op)ため、
// web では Alert 相当の命令的 API をストア + ホスト描画で再現する。
// ホスト(app-dialog-host.web.tsx)がルートレイアウトで購読して描画する。
// Alert と同じく同時に出るのは1枚(後勝ち)
type DialogState = {
  spec: DialogSpec | null;
};

export const useDialog = create<DialogState>(() => ({ spec: null }));

export function presentDialog(spec: DialogSpec) {
  useDialog.setState({ spec });
}

export function dismissDialog() {
  useDialog.setState({ spec: null });
}
