import { businessDay, businessMonth, businessMonthKey } from "./business-time";

describe("business time (Europe/Athens)", () => {
  it("uses the Athens calendar day, not UTC (summer, UTC+3)", () => {
    // 22:30 UTC on the 26th is already 01:30 on the 27th in Athens.
    const { start, end } = businessDay(new Date("2026-09-26T22:30:00Z"));
    expect(start.toISOString()).toBe("2026-09-26T21:00:00.000Z");
    expect(end.toISOString()).toBe("2026-09-27T21:00:00.000Z");
  });

  it("handles winter time (UTC+2)", () => {
    const { start, end } = businessDay(new Date("2026-12-15T10:00:00Z"));
    expect(start.toISOString()).toBe("2026-12-14T22:00:00.000Z");
    expect(end.toISOString()).toBe("2026-12-15T22:00:00.000Z");
  });

  it("gives a 25-hour day when clocks go back (25 Oct 2026)", () => {
    const { start, end } = businessDay(new Date("2026-10-25T12:00:00Z"));
    expect(start.toISOString()).toBe("2026-10-24T21:00:00.000Z");
    expect(end.toISOString()).toBe("2026-10-25T22:00:00.000Z");
  });

  it("spans whole local months, across the DST change and the year end", () => {
    const oct = businessMonth("2026-10");
    expect(oct.start.toISOString()).toBe("2026-09-30T21:00:00.000Z");
    expect(oct.end.toISOString()).toBe("2026-10-31T22:00:00.000Z");
    expect(businessMonth("2026-12").end.toISOString()).toBe("2026-12-31T22:00:00.000Z");
    expect(businessMonthKey(new Date("2026-09-30T21:30:00Z"))).toBe("2026-10");
  });
});
