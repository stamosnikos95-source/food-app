/** Pure analytics maths (M10), kept I/O-free so each rule is unit-tested. */

const round = (x: number, digits = 1) => Math.round(x * 10 ** digits) / 10 ** digits;

export interface PairStat {
  a: string;
  b: string;
  count: number;
  /** share of all orders containing both */
  support: number;
  /** of orders with A, the share that also had B (and vice versa) */
  confidenceAB: number;
  confidenceBA: number;
  /** > 1: bought together more often than chance */
  lift: number;
}

/**
 * Market-basket pairs: dishes bought in the same order more often than
 * chance. `baskets` is one list of dish ids per order (single-dish orders
 * count toward the base rates). Pairs seen fewer than `minCount` times are
 * noise and dropped.
 */
export function basketPairs(baskets: string[][], minCount = 3, top = 10): PairStat[] {
  const n = baskets.length;
  if (n === 0) return [];
  const single = new Map<string, number>();
  const pair = new Map<string, number>();
  const SEP = "\u0000";
  for (const basket of baskets) {
    const items = [...new Set(basket)].sort();
    for (const i of items) single.set(i, (single.get(i) ?? 0) + 1);
    for (let x = 0; x < items.length; x++) {
      for (let y = x + 1; y < items.length; y++) {
        const key = items[x] + SEP + items[y];
        pair.set(key, (pair.get(key) ?? 0) + 1);
      }
    }
  }
  return [...pair.entries()]
    .filter(([, count]) => count >= minCount)
    .map(([key, count]) => {
      const [a, b] = key.split(SEP);
      const ca = single.get(a)!, cb = single.get(b)!;
      return {
        a, b, count,
        support: round(count / n, 3),
        confidenceAB: round(count / ca, 3),
        confidenceBA: round(count / cb, 3),
        lift: round((count / n) / ((ca / n) * (cb / n)), 2),
      };
    })
    .sort((x, y) => y.lift - x.lift || y.count - x.count)
    .slice(0, top);
}

/** How far forecasts were from what actually sold. */
export function forecastAccuracy(rows: { predicted: number; actual: number }[]) {
  if (rows.length === 0) return null;
  const errors = rows.map((r) => r.predicted - r.actual);
  const withSales = rows.filter((r) => r.actual > 0);
  return {
    observations: rows.length,
    /** average miss, in portions */
    meanAbsoluteError: round(errors.reduce((s, e) => s + Math.abs(e), 0) / rows.length),
    /** > 0: we tend to over-forecast (waste); < 0: under-forecast (sell-outs) */
    bias: round(errors.reduce((s, e) => s + e, 0) / rows.length),
    /** average miss as % of what sold, on days with sales */
    meanAbsolutePercentError: withSales.length
      ? round((withSales.reduce((s, r) => s + Math.abs(r.predicted - r.actual) / r.actual, 0) / withSales.length) * 100)
      : null,
  };
}
