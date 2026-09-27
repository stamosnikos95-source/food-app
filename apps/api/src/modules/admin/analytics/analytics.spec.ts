import { basketPairs, forecastAccuracy } from "./analytics";

describe("basketPairs (market basket)", () => {
  it("finds dishes bought together more often than chance", () => {
    const baskets = [
      ["bowl", "juice"], ["bowl", "juice"], ["bowl", "juice"], ["bowl", "juice"],
      ["salmon"], ["salmon"], ["wrap"], ["bowl"], ["salad", "wrap"], ["salad"],
    ];
    const [top] = basketPairs(baskets, 3);
    // 4 of 10 orders have both; bowl in 5, juice in 4
    expect(top).toMatchObject({ a: "bowl", b: "juice", count: 4, support: 0.4, confidenceAB: 0.8, confidenceBA: 1, lift: 2 });
  });

  it("drops rare pairs as noise and counts a dish once per order", () => {
    expect(basketPairs([["a", "b"], ["a", "b"], ["c"]], 3)).toEqual([]);
    expect(basketPairs([["a", "a", "b"], ["a", "b"], ["a", "b"]], 3)[0].count).toBe(3);
    expect(basketPairs([], 3)).toEqual([]);
  });
});

describe("forecastAccuracy", () => {
  it("reports average miss, direction and percentage error", () => {
    const r = forecastAccuracy([
      { predicted: 22, actual: 20 },
      { predicted: 9, actual: 10 },
      { predicted: 5, actual: 0 },
    ]);
    expect(r).toEqual({ observations: 3, meanAbsoluteError: 2.7, bias: 2, meanAbsolutePercentError: 10 });
  });
  it("is null without data", () => expect(forecastAccuracy([])).toBeNull());
});
