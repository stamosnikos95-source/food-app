import { weekdayOf } from "../../companies/business-time";

/**
 * Demand forecast for one dish on one day (M7). Deliberately simple and
 * explainable: a recency-weighted average of the same weekday, plus a safety
 * margin scaled to how much sales vary. A learned model (M10) should replace
 * it only once there is enough history to beat it — measured against the
 * stored DemandForecast snapshots.
 */
export const FORECAST_MODEL = "weekday-ewma-v1";

const SAME_WEEKDAY_WINDOW = 6;
const RECENT_WINDOW = 14;
const MIN_SAME_WEEKDAY = 2;
const DECAY = 0.75; // each older observation counts 25% less

const WEEKDAY_GENITIVE_PLURAL = ["Κυριακών", "Δευτερών", "Τριτών", "Τετάρτων", "Πεμπτών", "Παρασκευών", "Σαββάτων"];

export type Confidence = "high" | "medium" | "low" | "none";

export interface DishForecast {
  predicted: number | null;
  recommended: number | null;
  observations: number;
  spread: number | null;
  confidence: Confidence;
  basis: string;
}

const round1 = (x: number) => Math.round(x * 10) / 10;
const fmt = (x: number) => String(round1(x)).replace(".", ",");

/**
 * @param history portions sold per business date ("YYYY-MM-DD") on days the
 *   business was open while the dish was on the menu; 0 = offered, none sold.
 * @param wasteRatio unsold ÷ produced for this dish over recent weeks (0–1).
 */
export function forecastDish(history: Record<string, number>, targetDate: string, wasteRatio = 0): DishForecast {
  const past = Object.entries(history)
    .filter(([day]) => day < targetDate)
    .sort(([a], [b]) => b.localeCompare(a)); // newest first
  const weekday = weekdayOf(targetDate);
  const sameWeekday = past.filter(([day]) => weekdayOf(day) === weekday).slice(0, SAME_WEEKDAY_WINDOW);
  const bySameWeekday = sameWeekday.length >= MIN_SAME_WEEKDAY;
  const sample = (bySameWeekday ? sameWeekday : past.slice(0, RECENT_WINDOW)).map(([, portions]) => portions);

  if (sample.length === 0) {
    return { predicted: null, recommended: null, observations: 0, spread: null, confidence: "none", basis: "Δεν υπάρχουν ακόμα πωλήσεις για αυτό το πιάτο." };
  }

  const weights = sample.map((_, i) => DECAY ** i);
  const weightSum = weights.reduce((a, b) => a + b, 0);
  const mean = sample.reduce((acc, v, i) => acc + weights[i] * v, 0) / weightSum;
  const spread = Math.sqrt(sample.reduce((acc, v, i) => acc + weights[i] * (v - mean) ** 2, 0) / weightSum);

  // Safety margin, in standard deviations: smaller when the dish is often left over.
  const z = wasteRatio > 0.15 ? 0 : wasteRatio > 0.08 ? 0.25 : 0.5;
  const recommended = mean === 0 ? 0 : Math.ceil(round1(mean + z * spread));

  const variation = mean > 0 ? spread / mean : Number.POSITIVE_INFINITY;
  const confidence: Confidence =
    bySameWeekday && sample.length >= 4 && variation <= 0.25 ? "high" : sample.length >= 3 && variation <= 0.5 ? "medium" : "low";

  let basis = bySameWeekday
    ? `Μέσος όρος των τελευταίων ${sample.length} ${WEEKDAY_GENITIVE_PLURAL[weekday]} (οι πιο πρόσφατες μετράνε περισσότερο): ${fmt(mean)} μερίδες, διακύμανση ±${fmt(spread)}.`
    : `Λίγα δεδομένα ακόμα· μέσος όρος των τελευταίων ${sample.length} ημερών λειτουργίας: ${fmt(mean)} μερίδες.`;
  if (z < 0.5) basis += " Μικρότερο περιθώριο, γιατί συχνά περισσεύει.";

  return { predicted: round1(mean), recommended, observations: sample.length, spread: round1(spread), confidence, basis };
}
