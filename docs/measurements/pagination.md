# A-7: OFFSET vs カーソルページネーション実測

対象: 全注文の新しい順ページ送り(ORDER BY ordered_at DESC, id DESC LIMIT 20)。
2026-08-21 実施。

## 結果(深さ = 読み飛ばす行数)

| 構成 | 深さ0 | 深さ1,000 | 深さ100,000 |
|---|---|---|---|
| インデックスなし + OFFSET | 5,450p / sort 27kB | 5,450p / sort 192kB | 5,450p / **external merge Disk 4.5MB** |
| btree(010)+ OFFSET | 5p | 26p | 2,198p(10万エントリを歩いて捨てる) |
| btree + カーソル | — | — | **5p / 0.06ms(深さ非依存)** |

カーソル: WHERE (ordered_at, id) < (最後に見た値) — 行値比較が丸ごと
Index Cond に入り、木を1回降りるだけ。O(深さ)を治せるのはカーソルのみで、
インデックスは定数を下げるだけ。

## 学び

- OFFSET は「OFFSET+LIMIT 行をソートに保持」するため work_mem を溢れさせる
  (LIMIT の top-N 最適化を OFFSET が食い潰す)
- ORDER BY 列 + ユニーク列のタイブレークで全順序にしないと、ページ境界で
  行の重複・欠落が起きうる。id を第2キーに入れる理由はカーソルの前提と兼用
- カーソルは任意ページへのジャンプ不可。無限スクロールUIはカーソル、
  ページ番号UIは OFFSET と、UI設計がクエリ設計を決める
- フェーズBの注文履歴APIは next_cursor を返す形にする(伏線)

## 事件簿: BRIN の恒久汚染

書き込みコスト実験(ROLLBACK済みINSERT)の副作用で、BRIN の区画メモが
全域 2026-08-21 まで広がり lossy=5450(全区画候補=無力化)になっていた。
min/max は広がる一方で ROLLBACK でも戻らない。REINDEX で修理(lossy=1098に復元)。
この脆さも 011 で BRIN を落とし btree(010)へ一本化した根拠の一つ。
