// ダイアログの「内容(何を出すか)」と「提示手段(どう出すか)」を分離するための語彙。
// 内容は place-order-alerts などプラットフォーム非依存のモジュールが組み立て、
// 提示は present-dialog(native = OS の Alert / web = 自前モーダル)が担う。
// エラー→表示の対応表を1本に保つのが目的 — 対応表を .web.ts に複製すると同期が規律頼みになる
// (仕組みで安全 > 規律で安全)。
// 前提: 語彙は Alert.alert にできることの部分集合に留める。Alert で表現できない
//   ダイアログが必要になったら、それは「web だけの機能」ではなく設計の再議論
export type DialogButton = {
  text: string;
  /** cancel は「何もしない離脱」。web モーダルの外側クリックもこれを実行する */
  style?: "default" | "cancel";
  onPress?: () => void;
};

export type DialogSpec = {
  title: string;
  message: string;
  /** 省略時は「OK」で閉じるだけ */
  buttons?: DialogButton[];
};
