// CSV ストリーム書き出し。
//
// PostgreSQL の COPY (FORMAT csv) の規約に合わせる:
//   - NULL は「引用符なしの空文字」で表現する
//   - 引用符付きの "" は「空文字列」であって NULL ではない(ここが引っかけ)
//   - フィールド内の " は "" にエスケープし、カンマ/改行/引用符を含むフィールドは必ず引用する
//
// 前提: 1行目はヘッダー。投入側(load.sh)は HEADER MATCH で列名を照合する(PG15+)。
//       列順のズレを仕組みで検出するため。

import { createWriteStream, type WriteStream } from "node:fs";
import { once } from "node:events";

export type Cell = string | number | boolean | null;

const NEEDS_QUOTE = /[",\n\r]/;

function escapeCell(v: Cell): string {
  if (v === null) return ""; // NULL: 引用符なしの空
  if (typeof v === "number") return String(v);
  if (typeof v === "boolean") return v ? "true" : "false";
  if (v === "") return '""'; // 空文字列は明示的に引用(NULLと区別)
  if (NEEDS_QUOTE.test(v)) return '"' + v.replaceAll('"', '""') + '"';
  return v;
}

export class CsvWriter {
  private stream: WriteStream;
  private buf: string[] = [];
  rows = 0;

  constructor(path: string, header: string[]) {
    this.stream = createWriteStream(path);
    this.buf.push(header.join(","));
  }

  async row(cells: Cell[]): Promise<void> {
    this.buf.push(cells.map(escapeCell).join(","));
    this.rows++;
    if (this.buf.length >= 5000) await this.flush();
  }

  private async flush(): Promise<void> {
    const chunk = this.buf.join("\n") + "\n";
    this.buf = [];
    if (!this.stream.write(chunk)) await once(this.stream, "drain"); // 背圧を尊重
  }

  async close(): Promise<void> {
    await this.flush();
    this.stream.end();
    await once(this.stream, "close");
  }
}
