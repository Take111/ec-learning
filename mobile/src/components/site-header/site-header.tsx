// web のみ存在する持続ナビゲーション(実装は同居の site-header.web.tsx)。
// ネイティブのナビはタブバー(NativeTabs)が担うため、ここでは何も描画しない。
// 呼び出し側(app/_layout)は分岐を知らない — sf-symbol と同じ同居ファイル方式
export function SiteHeader() {
  return null;
}
