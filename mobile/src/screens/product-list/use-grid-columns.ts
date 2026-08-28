// 商品グリッドの列数。native はモバイル幅前提の2列固定
// (web は同居の use-grid-columns.web.ts が画面幅から算出する)
export function useGridColumns(): number {
  return 2;
}
