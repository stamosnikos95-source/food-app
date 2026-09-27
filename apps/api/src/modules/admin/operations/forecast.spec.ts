import { forecastDish } from "./forecast";

// 2026-10-06 is a Tuesday; the Tuesdays before it: 09-29, 09-22, 09-15, 09-08.
const TUESDAY = "2026-10-06";

describe("forecastDish", () => {
  it("says so when there is no history yet", () => {
    expect(forecastDish({}, TUESDAY)).toMatchObject({ predicted: null, recommended: null, confidence: "none", observations: 0 });
  });

  it("uses the same weekday: steady Tuesdays give a confident, exact forecast", () => {
    const f = forecastDish({ "2026-09-29": 20, "2026-09-22": 20, "2026-09-15": 20, "2026-09-08": 20, "2026-10-02": 55 }, TUESDAY);
    expect(f).toMatchObject({ predicted: 20, recommended: 20, spread: 0, confidence: "high", observations: 4 });
    expect(f.basis).toContain("Τριτών");
  });

  it("weights recent weeks more and adds a margin for variation", () => {
    // newest-first [30, 10], weights [1, .75]: mean 21.4, spread 9.9 -> 21.4 + 0.5 x 9.9 = 26.4 -> 27
    const f = forecastDish({ "2026-09-29": 30, "2026-09-22": 10 }, TUESDAY);
    expect(f).toMatchObject({ predicted: 21.4, spread: 9.9, recommended: 27, confidence: "low" });
  });

  it("shrinks the margin for dishes that are often left over", () => {
    const f = forecastDish({ "2026-09-29": 30, "2026-09-22": 10 }, TUESDAY, 0.2);
    expect(f.recommended).toBe(22);
    expect(f.basis).toContain("Μικρότερο περιθώριο");
  });

  it("falls back to recent open days when a weekday has too little history", () => {
    const f = forecastDish({ "2026-09-29": 12, "2026-10-01": 8, "2026-10-02": 10, "2026-10-03": 10 }, TUESDAY);
    expect(f.observations).toBe(4);
    expect(f.basis).toContain("Λίγα δεδομένα");
  });

  it("never uses the target day or later, and forecasts 0 for dishes that don't sell", () => {
    expect(forecastDish({ "2026-10-06": 99, "2026-10-13": 99 }, TUESDAY).confidence).toBe("none");
    expect(forecastDish({ "2026-09-29": 0, "2026-09-22": 0 }, TUESDAY).recommended).toBe(0);
  });
});
