import { ApiError } from "./client";

/**
 * Turns any thrown value into user-facing Greek copy. Screens pass the
 * status codes that mean something specific in their context (e.g. 401 on
 * the login form means "wrong password", not "session expired").
 */
export function describeError(
  error: unknown,
  byStatus: Partial<Record<number, string>> = {},
): string {
  if (error instanceof ApiError) {
    const specific = byStatus[error.statusCode];
    if (specific) return specific;
    if (error.statusCode === 0) {
      return "Δεν υπάρχει σύνδεση με τον server. Αν είχε καιρό να χρησιμοποιηθεί, ξυπνάει — δοκίμασε ξανά σε λίγα δευτερόλεπτα.";
    }
    if (error.statusCode === 401) return "Η σύνδεσή σου έληξε. Συνδέσου ξανά.";
    if (error.statusCode >= 500) return "Πρόβλημα στον server. Δοκίμασε ξανά σε λίγο.";
  }
  return "Κάτι πήγε στραβά. Δοκίμασε ξανά.";
}
