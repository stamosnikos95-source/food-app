/**
 * Calendar days and months in the business's time zone. A "day" of company
 * allowance is an Athens day: an order at 01:00 local belongs to today, not
 * to yesterday as it would in UTC.
 */
export const BUSINESS_TIME_ZONE = "Europe/Athens";

function wallClock(instant: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).formatToParts(instant);
  const v = (type: string) => Number(parts.find((p) => p.type === type)!.value);
  return { year: v("year"), month: v("month"), day: v("day"), hour: v("hour"), minute: v("minute"), second: v("second") };
}

/** Zone offset from UTC, in ms, at the given instant. */
function offsetMs(instant: Date, timeZone: string): number {
  const w = wallClock(instant, timeZone);
  const wallAsUtc = Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, w.second);
  return wallAsUtc - Math.floor(instant.getTime() / 1000) * 1000;
}

/** The instant of local midnight for a calendar date (overflowing days/months roll over). */
function zonedMidnight(year: number, month: number, day: number, timeZone: string): Date {
  const utcMidnight = Date.UTC(year, month - 1, day);
  let t = utcMidnight - offsetMs(new Date(utcMidnight), timeZone);
  t = utcMidnight - offsetMs(new Date(t), timeZone); // settle across a DST change
  return new Date(t);
}

export function businessDay(instant = new Date(), timeZone = BUSINESS_TIME_ZONE) {
  const { year, month, day } = wallClock(instant, timeZone);
  return { start: zonedMidnight(year, month, day, timeZone), end: zonedMidnight(year, month, day + 1, timeZone) };
}

/** "2026-09" for the local month containing the instant. */
export function businessMonthKey(instant = new Date(), timeZone = BUSINESS_TIME_ZONE): string {
  const { year, month } = wallClock(instant, timeZone);
  return `${year}-${String(month).padStart(2, "0")}`;
}

export function businessMonth(key: string, timeZone = BUSINESS_TIME_ZONE) {
  const [year, month] = key.split("-").map(Number);
  return { start: zonedMidnight(year, month, 1, timeZone), end: zonedMidnight(year, month + 1, 1, timeZone) };
}
