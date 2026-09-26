export const formatPrice = (cents: number) => `${(cents / 100).toFixed(2).replace(".", ",")} €`;

/** Greek all-caps drop the tonos: "Σήμερα" -> "ΣΗΜΕΡΑ". */
export const upperGreek = (text: string) =>
  text.normalize("NFD").replace(/\u0301/g, "").normalize("NFC").toUpperCase();

export const formatTime = (iso: string) =>
  // 24-hour clock ("22:05"), as kitchens in Greece read time.
  new Date(iso).toLocaleTimeString("el-GR", { hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

export const minutesSince = (iso: string, now: number) =>
  Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60000));

/** "8,50" or "8.50" -> 850; undefined if not a number. */
export function parseEurosToCents(input: string): number | undefined {
  const value = Number(input.trim().replace(",", "."));
  return input.trim() && Number.isFinite(value) ? Math.round(value * 100) : undefined;
}

export function parseDecimal(input: string): number | undefined {
  const value = Number(input.trim().replace(",", "."));
  return input.trim() && Number.isFinite(value) ? value : undefined;
}
