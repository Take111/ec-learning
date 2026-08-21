# q5: 可視性マップ(VM)実験の記録

カバリングインデックス(009)適用後、Index Only Scan と VM の関係を
マイグレーション外の手動実験で確認した記録。2026-08-21 実施。

## 実験手順と結果

| 状態 | Buffers | Heap Fetches | 備考 |
|---|---|---|---|
| baseline(UNIQUE索引の流用) | 202,324 | — | rating がインデックスになく毎行ヒープ行き |
| 009 カバリング(INCLUDE) | 2,206 | 0 | IOS 成立。reviews の読みは 770ページ |
| VM汚染後 | 239,500 | 266,098 | 下記トリックの直後 |
| VACUUM reviews 後 | 2,777 | 0 | relallvisible 2,632/2,632 に復元 |

## VM汚染の再現方法(データを変えずに壊す)

```sql
BEGIN;
UPDATE reviews SET rating = rating WHERE id % 3 = 0;  -- 値を変えない更新
ROLLBACK;
```

- ROLLBACK してもヒープ各ページに廃版が残り、VM ビットが落ちる
- Heap Fetches 266,098 > 行数20万 の内訳: 生きた行の可視性確認 20万 +
  中断された更新が作った索引エントリ(廃版)の確認 6.6万
- rating は INCLUDE 列のため HOT 更新にならず、UPDATE が索引エントリを
  作ったことも観察ポイント(インデックスは書き込みを重くする、の実例)

## 学び

1. IOS は VM とセットでしか成立しない(インデックスは MVCC の可視性を知らない)
2. VM を立てるのは (auto)vacuum。PG13+ は INSERT のみのテーブルにも autovacuum が走る
   (A-4 で意図的に VACUUM を省いた仕込みは、数日のうちに autovacuum が無効化していた)
3. 中断トランザクション1本(論理的に無変更)で読みコストが108倍化する。
   物理状態は論理状態のロールバックでは戻らない
