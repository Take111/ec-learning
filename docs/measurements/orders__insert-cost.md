# orders: インデックスの書き込みコスト実測

インデックス構成別に 5万行 INSERT を EXPLAIN (ANALYZE, BUFFERS, WAL) で計測。
BEGIN〜ROLLBACK 内で実施(トランザクション内 DROP INDEX で構成を切り替え、全て巻き戻し)。
2026-08-21 実施。

## 結果

| 構成 | INSERT時間 | WAL bytes | dirtied | fpi |
|---|---|---|---|---|
| 制約2本のみ(pkey, idempotency UNIQUE) | 125 ms | 16.2 MB | 1,304 | 1 |
| + brin_orders_ordered_at | 138 ms | 15.7 MB | 1,156 | — |
| + idx_orders_user_id_ordered_at(現状) | 389 ms | 43.9 MB | 5,275 | 3,005 |

INSERT パターン: user_id はランダム分布、ordered_at = now()(追記)。

## 読み解き

- BRIN の書き込み税はほぼゼロ: 追記は最終区画の max 確認のみ(q2 で BRIN を選んだ判断の裏付け)
- 複合 btree は 3.1倍の時間・2.7倍の WAL: ランダムな user_id が 8.7MB の木の全域に
  着地し、fpi(チェックポイント後の初回タッチで8KB丸ごとWAL行き)を3,005回誘発
- この税で買ったのは q1 の読み 1/230(5,512→24ページ)。読み頻度 ≫ 書き頻度の
  ECでは黒字だが、損益はワークロード依存 — 「勝手に張らない」方針の定量根拠

## 注記(計測の限界)

- 5万行バルクの計測。1行ずつのOLTPではコミット毎のWAL flushが支配的になり比率は縮む
- 全ページキャッシュ済みの環境。コールドではランダム着地の読み込みコストも乗る
