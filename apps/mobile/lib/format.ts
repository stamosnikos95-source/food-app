/** 850 -> "8,50 €" (Greek convention: decimal comma, symbol after the amount). */
export function formatPrice(cents: number): string {
  // Non-breaking space: the amount and "€" never wrap onto separate lines.
  return `${(cents / 100).toFixed(2).replace(".", ",")}\u00A0€`;
}

/** 42 -> "42", 38.5 -> "38,5" */
export function formatGrams(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1).replace(".", ",");
}

/**
 * Greek all-caps drop the stress mark (tonos) but keep the diaeresis:
 * "Σάββατο 26 Μαΐου" -> "ΣΑΒΒΑΤΟ 26 ΜΑΪΟΥ". CSS/RN `textTransform: uppercase`
 * keeps the tonos on most platforms, so uppercase Greek text goes through this.
 */
export function upperGreek(text: string): string {
  return text.normalize("NFD").replace(/\u0301/g, "").normalize("NFC").toUpperCase();
}

const WEEKDAYS = ["Κυριακή", "Δευτέρα", "Τρίτη", "Τετάρτη", "Πέμπτη", "Παρασκευή", "Σάββατο"];
// Genitive month names, as dates are written in Greek ("26 Σεπτεμβρίου").
const MONTHS = [
  "Ιανουαρίου", "Φεβρουαρίου", "Μαρτίου", "Απριλίου", "Μαΐου", "Ιουνίου",
  "Ιουλίου", "Αυγούστου", "Σεπτεμβρίου", "Οκτωβρίου", "Νοεμβρίου", "Δεκεμβρίου",
];

/** -> "Σάββατο 26 Σεπτεμβρίου" */
export function formatLongDate(date: Date): string {
  return `${WEEKDAYS[date.getDay()]} ${date.getDate()} ${MONTHS[date.getMonth()]}`;
}

const MONTHS_SHORT = ["Ιαν", "Φεβ", "Μαρ", "Απρ", "Μαΐ", "Ιουν", "Ιουλ", "Αυγ", "Σεπ", "Οκτ", "Νοε", "Δεκ"];

/** -> "26 Σεπ, 20:45" */
export function formatShortDateTime(iso: string): string {
  const d = new Date(iso);
  const time = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}, ${time}`;
}

/** 1 -> "1 πιάτο", 3 -> "3 πιάτα" */
export function pluralDishes(count: number): string {
  return `${count} ${count === 1 ? "πιάτο" : "πιάτα"}`;
}

/** Accepts "8,50" as well as "8.50" — Greek keyboards type a comma. */
export function parseDecimal(input: string): number | undefined {
  const trimmed = input.trim().replace(",", ".");
  if (!trimmed) return undefined;
  const value = Number(trimmed);
  return Number.isFinite(value) ? value : undefined;
}
