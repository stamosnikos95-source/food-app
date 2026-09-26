import { Injectable, Logger, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Stripe from "stripe";
import {
  CheckoutRequest,
  CheckoutSessionInfo,
  CheckoutStatus,
  PaymentProvider,
} from "./payment-provider";

const KEY_PATTERN = /^(sk|rk)_(test|live)_[A-Za-z0-9]+$/;

@Injectable()
export class StripePaymentProvider implements PaymentProvider {
  readonly name = "stripe";
  readonly mode: "test" | "live" | "disabled";
  private readonly logger = new Logger(StripePaymentProvider.name);
  private readonly stripe: Stripe | null;
  private readonly webhookSecret: string | undefined;

  constructor(config: ConfigService) {
    const key = config.get<string>("STRIPE_SECRET_KEY");
    this.webhookSecret = config.get<string>("STRIPE_WEBHOOK_SECRET") || undefined;

    if (key && KEY_PATTERN.test(key)) {
      this.stripe = new Stripe(key);
      this.mode = key.includes("_live_") ? "live" : "test";
    } else {
      if (key) this.logger.error("STRIPE_SECRET_KEY is set but malformed; online payments disabled");
      this.stripe = null;
      this.mode = "disabled";
    }
    this.logger.log(
      `Online payments: ${this.mode === "disabled" ? "disabled" : `Stripe ${this.mode} mode`}; ` +
        `webhooks: ${this.webhookSecret ? "enabled" : "not configured"}`,
    );
  }

  private client(): Stripe {
    if (!this.stripe) throw new ServiceUnavailableException("Online payments are not configured");
    return this.stripe;
  }

  async createCheckout(request: CheckoutRequest) {
    const session = await this.client().checkout.sessions.create(
      {
        mode: "payment",
        locale: "el",
        customer_email: request.customerEmail,
        client_reference_id: request.orderId,
        metadata: { orderId: request.orderId, paymentId: request.paymentId },
        payment_intent_data: { metadata: { orderId: request.orderId } },
        line_items: request.lines.map((line) => ({
          quantity: line.quantity,
          price_data: {
            currency: request.currency,
            unit_amount: line.unitAmountCents,
            product_data: { name: line.name },
          },
        })),
        success_url: request.successUrl,
        cancel_url: request.cancelUrl,
        expires_at: Math.floor(request.expiresAt.getTime() / 1000),
      },
      // Retrying the same attempt can never open a second session.
      { idempotencyKey: `checkout-${request.paymentId}` },
    );

    if (!session.url) throw new Error(`Stripe session ${session.id} has no redirect URL`);
    return { providerRef: session.id, redirectUrl: session.url };
  }

  async getCheckout(providerRef: string): Promise<CheckoutSessionInfo> {
    return toSessionInfo(await this.client().checkout.sessions.retrieve(providerRef));
  }

  async expireCheckout(providerRef: string): Promise<void> {
    await this.client().checkout.sessions.expire(providerRef);
  }

  parseWebhook(rawBody: Buffer, signature: string): CheckoutSessionInfo | null {
    if (!this.webhookSecret) {
      throw new ServiceUnavailableException("Stripe webhooks are not configured");
    }
    // Throws if the signature doesn't match the raw body (forged or altered).
    const event = this.client().webhooks.constructEvent(rawBody, signature, this.webhookSecret);

    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded":
      case "checkout.session.expired":
        return toSessionInfo(event.data.object);
      case "checkout.session.async_payment_failed":
        return { ...toSessionInfo(event.data.object), status: "failed" };
      default:
        return null;
    }
  }
}

export function toSessionInfo(session: Stripe.Checkout.Session): CheckoutSessionInfo {
  let status: CheckoutStatus;
  if (session.payment_status === "paid") status = "paid";
  else if (session.status === "expired") status = "expired";
  else if (session.status === "open") status = "open";
  else status = "processing";

  return {
    providerRef: session.id,
    status,
    amountTotalCents: session.amount_total,
    currency: session.currency,
    orderId: session.metadata?.orderId ?? session.client_reference_id ?? null,
  };
}
