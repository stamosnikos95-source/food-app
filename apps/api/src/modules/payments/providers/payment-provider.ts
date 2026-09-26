/**
 * Boundary between our payment logic and a specific processor. Everything
 * outside `providers/` talks to this interface, so adding e.g. Viva Wallet
 * later means one new class, not changes across the codebase.
 */
export const PAYMENT_PROVIDER = Symbol("PAYMENT_PROVIDER");

export interface CheckoutLine {
  name: string;
  unitAmountCents: number;
  quantity: number;
}

export interface CheckoutRequest {
  orderId: string;
  paymentId: string;
  customerEmail: string;
  currency: "eur";
  lines: CheckoutLine[];
  successUrl: string;
  cancelUrl: string;
  expiresAt: Date;
}

/**
 * open:       customer hasn't finished yet
 * processing: finished, but an asynchronous method hasn't settled
 * paid:       money captured
 * failed:     asynchronous method failed
 * expired:    session closed without payment
 */
export type CheckoutStatus = "open" | "processing" | "paid" | "failed" | "expired";

export interface CheckoutSessionInfo {
  providerRef: string;
  status: CheckoutStatus;
  amountTotalCents: number | null;
  currency: string | null;
  orderId: string | null;
}

export interface PaymentProvider {
  readonly name: string;
  readonly mode: "test" | "live" | "disabled";
  createCheckout(request: CheckoutRequest): Promise<{ providerRef: string; redirectUrl: string }>;
  getCheckout(providerRef: string): Promise<CheckoutSessionInfo>;
  expireCheckout(providerRef: string): Promise<void>;
  /** Verifies the signature; returns null for event types we don't act on. */
  parseWebhook(rawBody: Buffer, signature: string): CheckoutSessionInfo | null;
}
