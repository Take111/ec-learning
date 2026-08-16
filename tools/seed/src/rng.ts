// シード付き乱数と分布関数。
//
// 前提: 再現性が最優先(CSVはgit管理しないため、同じシードから同じCSVを
//       再生成できることが唯一の担保)。Math.random / crypto.randomUUID は
//       シードできないのでここでは使わない。

/** mulberry32: 小さく高速なシード付きPRNG。暗号用途ではない(学習データ生成なので十分) */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type Rng = () => number;

/** [min, max] の整数(両端含む) */
export function randInt(rng: Rng, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

export function pick<T>(rng: Rng, arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}

/** 重み付きで index を選ぶための累積分布。二分探索で O(log n) サンプリング */
export class WeightedSampler {
  private cum: Float64Array;
  constructor(weights: ArrayLike<number>) {
    this.cum = new Float64Array(weights.length);
    let s = 0;
    for (let i = 0; i < weights.length; i++) {
      s += weights[i];
      this.cum[i] = s;
    }
  }
  sample(rng: Rng): number {
    const x = rng() * this.cum[this.cum.length - 1];
    // lower_bound
    let lo = 0, hi = this.cum.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (this.cum[mid] < x) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  }
}

/**
 * Zipf風の重み列 w_i = 1 / (i+1)^s を返す。
 * s=0.7 で上位1%が全体の約25%を占める(ユーザーの注文数の偏り用)。
 * s=1.0 で上位20%が全体の約85%を占める(商品の売れ方=パレート用)。
 * ※ 閉形式の厳密値ではなく近似。狙いは「プランナ観察に十分な偏り」であって統計的正確さではない。
 */
export function zipfWeights(n: number, s: number): Float64Array {
  const w = new Float64Array(n);
  for (let i = 0; i < n; i++) w[i] = 1 / Math.pow(i + 1, s);
  return w;
}

/** Box-Muller 標準正規乱数 */
export function normal(rng: Rng): number {
  const u = Math.max(rng(), 1e-12);
  const v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/** 対数正規: 価格分布用(安価品が多数、高額品がロングテール) */
export function logNormal(rng: Rng, mu: number, sigma: number): number {
  return Math.exp(mu + sigma * normal(rng));
}

/** Fisher-Yates。rank→id の対応をシャッフルして「idが若い=ヘビー」の相関を消すのに使う */
export function shuffle<T>(rng: Rng, arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** シード付き UUID v4(crypto.randomUUID はシードできないため自前生成) */
export function uuidV4(rng: Rng): string {
  const hex = "0123456789abcdef";
  let s = "";
  for (let i = 0; i < 36; i++) {
    if (i === 8 || i === 13 || i === 18 || i === 23) s += "-";
    else if (i === 14) s += "4"; // version
    else if (i === 19) s += hex[8 + Math.floor(rng() * 4)]; // variant: 8,9,a,b
    else s += hex[Math.floor(rng() * 16)];
  }
  return s;
}

/**
 * 直近偏重の日時サンプリング: anchor から遡って windowMs の範囲、u^2 で直近に密。
 * (u~一様 → u^2 は0付近=直近に集中する。密度は経過時間xに対して 1/(2√x) )
 */
export function recentBiasedTime(rng: Rng, anchorMs: number, windowMs: number): number {
  const u = rng();
  return anchorMs - windowMs * u * u;
}
