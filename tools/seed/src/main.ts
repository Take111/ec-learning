// 8テーブル分のCSVを生成する(FK依存順)。
//
// 再現性の担保(CSVはgit管理しないため、ここが崩れると同じデータを二度と作れない):
//   1. 乱数は全てシード付き(rng.ts)。Math.random / crypto.randomUUID は使わない
//   2. 「現在時刻」も固定(ANCHOR)。Date.now() を使うと実行日ごとに違うCSVになる
//
// メモリ戦略: users / products は注文生成に必要なのでメモリ保持(10万+5万件、数百MB以下)。
//             order_items(120万行)はストリームで書き捨てる。
//
// id と時刻の相関: 実システムでは採番順と発生時刻が相関する(後のBRINインデックス等の
//             実験が現実的になる)ため、users / orders / reviews は時刻順に並べてから採番する。

import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { fakerJA } from "@faker-js/faker";
import {
  mulberry32, randInt, pick, WeightedSampler, zipfWeights, logNormal,
  shuffle, uuidV4, recentBiasedTime, type Rng,
} from "./rng.js";
import { CsvWriter, type Cell } from "./csv.js";
import {
  PREFECTURES, CATEGORY_TREE, BRANDS, MODIFIERS, GRADES,
  DESCRIPTION_TEMPLATES, REVIEW_TEMPLATES_HIGH, REVIEW_TEMPLATES_MID,
  REVIEW_TEMPLATES_LOW, BUILDING_PREFIX, BUILDING_SUFFIX, ADDRESS_LABELS,
} from "./master.js";

// ---------- 定数(前提が変わる箇所) ----------
const SEED = 20260817;
/** 固定の基準日時。全ての時刻はここから遡って生成する(実行日に依存させない) */
const ANCHOR = Date.UTC(2026, 7, 17, 0, 0, 0); // 2026-08-17T00:00:00Z
const DAY = 24 * 60 * 60 * 1000;
const ORDER_WINDOW = 730 * DAY;   // 注文は直近2年
const USER_WINDOW = 1460 * DAY;   // ユーザー登録は直近4年

const N_USERS = 100_000;
const N_PRODUCTS = 50_000;
const N_ORDERS = 300_000;
const N_ORDER_ITEMS = 1_200_000;  // ちょうどこの行数に補正する
const N_REVIEWS = 200_000;

const FREE_SHIPPING_LINE = 5_000; // 送料無料ライン(円)。未満は一律550円
const SHIPPING_FEE = 550;

const OUT_DIR = path.resolve(fileURLToPath(import.meta.url), "../../../../data");

const rng: Rng = mulberry32(SEED);
fakerJA.seed(SEED);

const iso = (ms: number) => new Date(ms).toISOString();

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const t0 = performance.now();
  const done = (label: string, w: CsvWriter) =>
    console.log(`${label.padEnd(15)} ${String(w.rows).padStart(9)} 行  (${((performance.now() - t0) / 1000).toFixed(1)}s)`);

  // ---------- categories(50件: 大分類10 + 小分類40) ----------
  const catWriter = new CsvWriter(path.join(OUT_DIR, "categories.csv"), ["id", "name", "parent_id"]);
  const childCategoryIds: number[] = [];
  const childNouns: string[][] = []; // childCategoryIds と同順
  {
    let id = 0;
    for (const root of CATEGORY_TREE) {
      const rootId = ++id;
      await catWriter.row([rootId, root.root, null]);
      for (const child of root.children) {
        const childId = ++id;
        await catWriter.row([childId, child.name, rootId]);
        childCategoryIds.push(childId);
        childNouns.push([...child.nouns]);
      }
    }
    await catWriter.close();
    done("categories", catWriter);
  }

  // ---------- users(10万件)+ user_addresses ----------
  // 都道府県は人口比。東京は選択率>10%になり「インデックスが効かない条件」の教材になる
  const prefSampler = new WeightedSampler(PREFECTURES.map(([, w]) => w));
  const namePool = Array.from({ length: 2000 }, () => fakerJA.person.fullName());
  const cityPool = Array.from({ length: 300 }, () => fakerJA.location.city());
  const emailDomains = ["example.com", "example.net", "example.org"]; // RFC 2606 予約ドメインのみ使う
  const emailLocal = ["sato", "suzuki", "takahashi", "tanaka", "watanabe", "ito", "yamamoto", "nakamura", "kobayashi", "kato"];

  type Address = { postal: string; pref: string; line1: string; line2: string | null };
  const makeAddress = (pref: string): Address => ({
    postal: `${String(randInt(rng, 100, 999))}-${String(randInt(rng, 0, 9999)).padStart(4, "0")}`,
    pref,
    line1: `${pick(rng, cityPool)}${randInt(rng, 1, 6)}丁目${randInt(rng, 1, 30)}-${randInt(rng, 1, 20)}`,
    line2: rng() < 0.3
      ? `${pick(rng, BUILDING_PREFIX)}${pick(rng, BUILDING_SUFFIX)}${randInt(rng, 101, 1509)}号室`
      : null,
  });

  // 登録日時を先に引いて昇順に並べる → id と created_at が相関(実システムの性質)
  // 上限は基準日の2日前: 「登録+1h」の注文クランプが基準日を未来側に越えないようにする
  const userCreatedAt = Array.from(
    { length: N_USERS },
    () => ANCHOR - 2 * DAY - rng() * (USER_WINDOW - 2 * DAY),
  ).sort((a, b) => a - b);

  type User = { createdAt: number; prefecture: string; primary: Address; secondary: Address | null };
  const users: User[] = new Array(N_USERS);

  {
    const w = new CsvWriter(path.join(OUT_DIR, "users.csv"), ["id", "email", "name", "prefecture", "created_at"]);
    const wa = new CsvWriter(path.join(OUT_DIR, "user_addresses.csv"),
      ["id", "user_id", "label", "postal_code", "prefecture", "line1", "line2"]);
    let addrId = 0;
    for (let i = 0; i < N_USERS; i++) {
      const userId = i + 1;
      const prefecture = PREFECTURES[prefSampler.sample(rng)][0];
      // email は id を含めて一意性を仕組みで担保(10万件で衝突チェックしない)
      const email = `${pick(rng, emailLocal)}.${userId}@${pick(rng, emailDomains)}`;
      await w.row([userId, email, pick(rng, namePool), prefecture, iso(userCreatedAt[i])]);

      // 住所: 1件(60%) / 2件(30%) / 3件(10%)。1件目は「自宅」で users.prefecture と一致させる
      // (users.prefecture は主所在地の非正規化とみなす前提)
      const r = rng();
      const nAddr = r < 0.6 ? 1 : r < 0.9 ? 2 : 3;
      const primary = makeAddress(prefecture);
      await wa.row([++addrId, userId, "自宅", primary.postal, primary.pref, primary.line1, primary.line2]);
      let secondary: Address | null = null;
      for (let a = 1; a < nAddr; a++) {
        const addr = makeAddress(PREFECTURES[prefSampler.sample(rng)][0]);
        if (a === 1) secondary = addr;
        await wa.row([++addrId, userId, ADDRESS_LABELS[a], addr.postal, addr.pref, addr.line1, addr.line2]);
      }
      users[i] = { createdAt: userCreatedAt[i], prefecture, primary, secondary };
    }
    await w.close(); await wa.close();
    done("users", w); done("user_addresses", wa);
  }

  // ---------- products(5万件) ----------
  // created_at は注文ウィンドウ開始前に収める前提(全商品が全期間に存在する)。
  // 前提が変わる箇所: 「新商品の発売日×売上」を分析したくなったら、この生成と
  //                   注文側の商品選択(発売前の商品を除外)を変えること。
  const productPrice = new Int32Array(N_PRODUCTS);
  {
    const w = new CsvWriter(path.join(OUT_DIR, "products.csv"),
      ["id", "category_id", "name", "description", "price_jpy", "stock", "is_active", "created_at"]);
    for (let i = 0; i < N_PRODUCTS; i++) {
      const ci = randInt(rng, 0, childCategoryIds.length - 1);
      const noun = pick(rng, childNouns[ci]);
      const name = `${pick(rng, BRANDS)} ${pick(rng, MODIFIERS)}${noun}${pick(rng, GRADES)}`;
      // 価格は対数正規: 中央値2,500円前後、高額品がロングテール。10円単位に丸める
      const price = Math.min(300_000, Math.max(100, Math.round(logNormal(rng, Math.log(2500), 1.0) / 10) * 10));
      productPrice[i] = price;
      // 在庫: 10%を欠品(0)に。部分インデックス WHERE is_active AND stock > 0 の練習台
      const stock = rng() < 0.1 ? 0 : Math.min(2000, Math.max(1, Math.floor(logNormal(rng, Math.log(40), 0.9))));
      const isActive = rng() < 0.95;
      const description = rng() < 0.9 ? pick(rng, DESCRIPTION_TEMPLATES).replaceAll("{noun}", noun) : null;
      const createdAt = ANCHOR - ORDER_WINDOW - rng() * (USER_WINDOW - ORDER_WINDOW);
      await w.row([i + 1, childCategoryIds[ci], name, description, price, stock, isActive, iso(createdAt)]);
    }
    await w.close();
    done("products", w);
  }

  // ---------- orders + order_items + payments ----------
  // ユーザーの注文数は Zipf(s=0.7): 上位1%が全体の約25%。
  // 商品の売れ方も Zipf(s=1.0): 上位20%が売上の約85%(パレート)。
  // どちらも rank→id をシャッフルし「idが若い=ヘビー」という不自然な相関を消す。
  const userSampler = new WeightedSampler(zipfWeights(N_USERS, 0.7));
  const userPerm = shuffle(rng, Array.from({ length: N_USERS }, (_, i) => i));
  const productSampler = new WeightedSampler(zipfWeights(N_PRODUCTS, 1.0));
  const productPerm = shuffle(rng, Array.from({ length: N_PRODUCTS }, (_, i) => i));

  // 注文日時: 直近2年、直近ほど密。
  // 注文者を先に確定し「登録前の注文は存在できない」クランプを済ませてから
  // 時刻順に並べ替えて採番する(クランプ後に並べ替えないと id と時刻の相関が崩れる)
  const orderUsers = new Uint32Array(N_ORDERS);
  const orderTimes = new Float64Array(N_ORDERS);
  {
    for (let i = 0; i < N_ORDERS; i++) {
      const uIdx = userPerm[userSampler.sample(rng)];
      const t = recentBiasedTime(rng, ANCHOR - 5 * 60_000, ORDER_WINDOW);
      orderUsers[i] = uIdx;
      orderTimes[i] = Math.max(t, users[uIdx].createdAt + 60 * 60_000);
    }
    const idx = Array.from({ length: N_ORDERS }, (_, i) => i).sort((a, b) => orderTimes[a] - orderTimes[b]);
    const u2 = new Uint32Array(N_ORDERS);
    const t2 = new Float64Array(N_ORDERS);
    for (let i = 0; i < N_ORDERS; i++) { u2[i] = orderUsers[idx[i]]; t2[i] = orderTimes[idx[i]]; }
    orderUsers.set(u2); orderTimes.set(t2);
  }

  // 注文ごとの商品種類数を先に引き、合計がちょうど N_ORDER_ITEMS になるよう補正する
  const itemCountSampler = new WeightedSampler([14, 17, 17, 15, 12, 9, 6, 5, 2, 3]); // 1..10種類
  const itemCounts = new Uint8Array(N_ORDERS);
  let itemSum = 0;
  for (let i = 0; i < N_ORDERS; i++) { itemCounts[i] = itemCountSampler.sample(rng) + 1; itemSum += itemCounts[i]; }
  while (itemSum !== N_ORDER_ITEMS) {
    const i = randInt(rng, 0, N_ORDERS - 1);
    if (itemSum > N_ORDER_ITEMS && itemCounts[i] > 1) { itemCounts[i]--; itemSum--; }
    else if (itemSum < N_ORDER_ITEMS && itemCounts[i] < 10) { itemCounts[i]++; itemSum++; }
  }

  // レビュー候補: delivered 注文の (user, product) ペアを収集(購入者しかレビューできない前提)
  const reviewSeen = new Set<number>();
  const reviewKeys: number[] = [];
  const reviewTimes: number[] = [];

  {
    const wo = new CsvWriter(path.join(OUT_DIR, "orders.csv"),
      ["id", "idempotency_key", "user_id", "status", "total_jpy", "shipping_fee_jpy",
        "ship_to_postal_code", "ship_to_prefecture", "ship_to_line1", "ship_to_line2", "ordered_at"]);
    const wi = new CsvWriter(path.join(OUT_DIR, "order_items.csv"),
      ["id", "order_id", "product_id", "quantity", "unit_price_jpy"]);
    const wp = new CsvWriter(path.join(OUT_DIR, "payments.csv"),
      ["id", "order_id", "method", "amount_jpy", "status", "attempted_at"]);

    const quantitySampler = new WeightedSampler([70, 20, 7, 2, 1]); // 1..5個
    const methods = ["card", "convenience_store", "bank_transfer"] as const;
    const pickMethod = () => { const r = rng(); return r < 0.7 ? methods[0] : r < 0.9 ? methods[1] : methods[2]; };

    let itemId = 0, paymentId = 0;
    for (let o = 0; o < N_ORDERS; o++) {
      const orderId = o + 1;
      const userIdx = orderUsers[o];
      const user = users[userIdx];
      const orderedAt = orderTimes[o];
      const ageDays = (ANCHOR - orderedAt) / DAY;

      // 明細: 同一注文内の商品重複は禁止(実務ではカートでマージされる前提)
      const chosen = new Set<number>();
      let subtotal = 0;
      const items: [number, number, number][] = []; // [productIdx, quantity, unitPrice]
      while (items.length < itemCounts[o]) {
        let pIdx = productPerm[productSampler.sample(rng)];
        if (chosen.has(pIdx)) continue; // ヘッド商品は衝突しやすいが数十万分の一なので引き直しで十分
        chosen.add(pIdx);
        const quantity = quantitySampler.sample(rng) + 1;
        // 価格スナップショット: 古い注文ほど現在価格からの乖離を許す(価格改定の擬似表現)。
        // products.price_jpy と一致しない行が存在するのが「正しい」状態
        const drift = (rng() * 2 - 1) * 0.15 * (ageDays / 730);
        const unitPrice = Math.max(10, Math.round((productPrice[pIdx] * (1 + drift)) / 10) * 10);
        items.push([pIdx, quantity, unitPrice]);
        subtotal += unitPrice * quantity;
      }
      const shippingFee = subtotal >= FREE_SHIPPING_LINE ? 0 : SHIPPING_FEE;
      const total = subtotal + shippingFee;

      // ステータスは経過日数で決める(古い注文ほど delivered に収束)
      const r = rng();
      let status: string;
      if (ageDays < 1) status = r < 0.40 ? "pending" : r < 0.80 ? "paid" : r < 0.95 ? "shipped" : "cancelled";
      else if (ageDays < 3) status = r < 0.15 ? "pending" : r < 0.45 ? "paid" : r < 0.85 ? "shipped" : r < 0.95 ? "delivered" : "cancelled";
      else if (ageDays < 14) status = r < 0.05 ? "pending" : r < 0.15 ? "paid" : r < 0.45 ? "shipped" : r < 0.95 ? "delivered" : "cancelled";
      else status = r < 0.93 ? "delivered" : r < 0.97 ? "cancelled" : r < 0.99 ? "shipped" : "paid";

      // 配送先: 90%は自宅(1件目)、2件目があれば10%はそちら(スナップショットのコピー元)
      const addr = user.secondary && rng() < 0.1 ? user.secondary : user.primary;

      await wo.row([orderId, uuidV4(rng), userIdx + 1, status, total, shippingFee,
        addr.postal, addr.pref, addr.line1, addr.line2, iso(orderedAt)]);
      for (const [pIdx, quantity, unitPrice] of items) {
        await wi.row([++itemId, orderId, pIdx + 1, quantity, unitPrice]);
      }

      // 決済: status と整合させる(イベントはINSERTのみ、失敗も1行として残る)
      const minutes = (n: number) => n * 60_000;
      if (status === "pending") {
        if (rng() < 0.3) await wp.row([++paymentId, orderId, pickMethod(), total, "pending", iso(orderedAt + minutes(randInt(rng, 1, 30)))]);
        // 残り70%は決済未着手(コンビニ/銀行振込の入金待ちなど)
      } else if (status === "cancelled") {
        const rc = rng();
        if (rc < 0.5) { /* 支払前キャンセル: 決済行なし */ }
        else if (rc < 0.8) await wp.row([++paymentId, orderId, "card", total, "failed", iso(orderedAt + minutes(randInt(rng, 1, 10)))]);
        else {
          // 支払後キャンセル: 成功行 + 返金(マイナス金額)行。SUM で実収額0になる
          const paidAt = orderedAt + minutes(randInt(rng, 1, 30));
          await wp.row([++paymentId, orderId, "card", total, "succeeded", iso(paidAt)]);
          await wp.row([++paymentId, orderId, "card", -total, "succeeded", iso(paidAt + randInt(rng, 1, 10) * DAY)]);
        }
      } else { // paid / shipped / delivered
        const method = pickMethod();
        let t = orderedAt + minutes(randInt(rng, 1, 10));
        if (rng() < 0.07) { // カード決済失敗→再試行のパターン
          await wp.row([++paymentId, orderId, method, total, "failed", iso(t)]);
          t += minutes(randInt(rng, 2, 20));
        }
        await wp.row([++paymentId, orderId, method, total, "succeeded", iso(t)]);
      }

      // レビュー候補(delivered のみ)。key = userId * 1e6 + productId(2^53 に収まる)
      if (status === "delivered") {
        for (const [pIdx] of items) {
          const key = (userIdx + 1) * 1_000_000 + (pIdx + 1);
          if (!reviewSeen.has(key)) {
            reviewSeen.add(key);
            reviewKeys.push(key);
            reviewTimes.push(orderedAt);
          }
        }
      }
    }
    await wo.close(); await wi.close(); await wp.close();
    done("orders", wo); done("order_items", wi); done("payments", wp);
  }

  // ---------- reviews(20万件) ----------
  // 「実際に買った(delivered)ユーザーだけがレビューできる」前提。
  // 候補ペアから部分Fisher-Yatesで20万件をサンプリング → UNIQUE(product_id, user_id) は生成時点で保証
  {
    if (reviewKeys.length < N_REVIEWS) {
      throw new Error(`レビュー候補が不足: ${reviewKeys.length} < ${N_REVIEWS}(分布パラメータを見直すこと)`);
    }
    for (let i = 0; i < N_REVIEWS; i++) { // 先頭 N_REVIEWS 件だけシャッフルすれば十分
      const j = randInt(rng, i, reviewKeys.length - 1);
      [reviewKeys[i], reviewKeys[j]] = [reviewKeys[j], reviewKeys[i]];
      [reviewTimes[i], reviewTimes[j]] = [reviewTimes[j], reviewTimes[i]];
    }
    // 評価はJ字分布: ★5が約半分、★1が1割(HAVING avg >= 4 が広く当たる教材)
    const ratingSampler = new WeightedSampler([10, 8, 12, 22, 48]); // 1..5
    const rows: [number, number, number, number, string | null, number][] = [];
    for (let i = 0; i < N_REVIEWS; i++) {
      const userId = Math.floor(reviewKeys[i] / 1_000_000);
      const productId = reviewKeys[i] % 1_000_000;
      const rating = ratingSampler.sample(rng) + 1;
      const body = rng() < 0.6
        ? pick(rng, rating >= 4 ? REVIEW_TEMPLATES_HIGH : rating === 3 ? REVIEW_TEMPLATES_MID : REVIEW_TEMPLATES_LOW)
        : null;
      const createdAt = Math.min(ANCHOR - 60_000, reviewTimes[i] + randInt(rng, 2, 45) * DAY);
      rows.push([0, productId, userId, rating, body, createdAt]);
    }
    rows.sort((a, b) => a[5] - b[5]); // 時刻順に採番
    const w = new CsvWriter(path.join(OUT_DIR, "reviews.csv"),
      ["id", "product_id", "user_id", "rating", "body", "created_at"]);
    for (let i = 0; i < rows.length; i++) {
      const [, productId, userId, rating, body, createdAt] = rows[i];
      await w.row([i + 1, productId, userId, rating, body, iso(createdAt)] as Cell[]);
    }
    await w.close();
    done("reviews", w);
  }

  console.log(`\n完了: ${((performance.now() - t0) / 1000).toFixed(1)}s  出力先: ${OUT_DIR}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
