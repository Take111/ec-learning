// ネイティブは OS の Alert が表示を担うため、描画先(ホスト)は不要。
// web 実装は同居の app-dialog-host.web.tsx — 呼び出し側(app/_layout)は分岐を知らない
export function AppDialogHost() {
  return null;
}
