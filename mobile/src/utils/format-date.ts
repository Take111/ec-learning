// 注文履歴の日時表示。API の ordered_at(RFC3339)を日本語表記へ集約変換
const fmt = new Intl.DateTimeFormat("ja-JP", {
  year: "numeric",
  month: "long",
  day: "numeric",
});

export function formatDate(iso: string): string {
  return fmt.format(new Date(iso));
}
