import { ConfigService } from "@nestjs/config";
import Stripe from "stripe";
import { StripePaymentProvider } from "./stripe-payment.provider";

const WEBHOOK_SECRET = "whsec_test_secret_for_unit_tests";

function providerWith(values: Record<string, string | undefined>) {
  const config = { get: jest.fn((key: string) => values[key]) } as unknown as ConfigService;
  return new StripePaymentProvider(config);
}

describe("StripePaymentProvider", () => {
  it("is disabled without a key, and with a malformed key", () => {
    expect(providerWith({}).mode).toBe("disabled");
    expect(providerWith({ STRIPE_SECRET_KEY: "not-a-key" }).mode).toBe("disabled");
  });

  it("reports test mode for a sandbox key", () => {
    expect(providerWith({ STRIPE_SECRET_KEY: "sk_test_abc123" }).mode).toBe("test");
  });

  describe("parseWebhook", () => {
    const provider = providerWith({
      STRIPE_SECRET_KEY: "sk_test_abc123",
      STRIPE_WEBHOOK_SECRET: WEBHOOK_SECRET,
    });
    const payload = JSON.stringify({
      id: "evt_1",
      object: "event",
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_test_abc",
          object: "checkout.session",
          status: "complete",
          payment_status: "paid",
          amount_total: 2480,
          currency: "eur",
          metadata: { orderId: "order-1" },
          client_reference_id: "order-1",
        },
      },
    });
    const sign = (body: string) =>
      new Stripe("sk_test_abc123").webhooks.generateTestHeaderString({
        payload: body,
        secret: WEBHOOK_SECRET,
      });

    it("accepts a correctly signed event and maps it", () => {
      const info = provider.parseWebhook(Buffer.from(payload), sign(payload));
      expect(info).toEqual({
        providerRef: "cs_test_abc",
        status: "paid",
        amountTotalCents: 2480,
        currency: "eur",
        orderId: "order-1",
      });
    });

    it("rejects a payload altered after signing", () => {
      const tampered = payload.replace("2480", "1");
      expect(() => provider.parseWebhook(Buffer.from(tampered), sign(payload))).toThrow();
    });
  });
});
