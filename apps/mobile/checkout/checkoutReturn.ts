import { Platform } from "react-native";

export type CheckoutReturn =
  | { outcome: "success"; orderId: string; sessionId: string }
  | { outcome: "cancelled"; orderId: string };

let cached: CheckoutReturn | null | undefined;

/**
 * The hosted checkout redirects back to `/?checkout=success&order=…&session_id=…`
 * (or `checkout=cancelled`). Read that once, then strip it from the address bar
 * so a refresh doesn't replay it. Native deep-link returns arrive in a later
 * milestone together with the store builds.
 */
export function peekCheckoutReturn(): CheckoutReturn | null {
  if (cached !== undefined) return cached;
  cached = null;
  if (Platform.OS !== "web" || typeof window === "undefined") return cached;

  const params = new URLSearchParams(window.location.search);
  const outcome = params.get("checkout");
  const orderId = params.get("order");
  const sessionId = params.get("session_id");
  if (outcome) window.history.replaceState(null, "", window.location.pathname);

  if (orderId && outcome === "success" && sessionId) {
    cached = { outcome: "success", orderId, sessionId };
  } else if (orderId && outcome === "cancelled") {
    cached = { outcome: "cancelled", orderId };
  }
  return cached;
}

export function clearCheckoutReturn(): void {
  cached = null;
}
