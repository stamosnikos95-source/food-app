import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PaymentsService } from "./payments.service";
import { PrismaService } from "../../prisma/prisma.service";
import { CheckoutSessionInfo, PaymentProvider } from "./providers/payment-provider";

const ORDER_ID = "11111111-1111-4111-8111-111111111111";

function makeOrder(overrides: Record<string, unknown> = {}) {
  return {
    id: ORDER_ID,
    userId: "u1",
    status: "pending",
    totalPriceCents: 2480,
    companyPaidCents: 0, // column is NOT NULL DEFAULT 0
    user: { email: "c@example.com" },
    items: [
      { quantity: 2, unitPriceCents: 850, menuItem: { name: "Bowl κοτόπουλο & κινόα" } },
      { quantity: 1, unitPriceCents: 780, menuItem: { name: "Buddha bowl λαχανικών" } },
    ],
    ...overrides,
  };
}

function makePayment(overrides: Record<string, unknown> = {}) {
  return {
    id: "p1",
    orderId: ORDER_ID,
    provider: "stripe",
    providerRef: "cs_test_abc",
    status: "pending",
    amountCents: 2480,
    currency: "eur",
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function paidInfo(overrides: Partial<CheckoutSessionInfo> = {}): CheckoutSessionInfo {
  return {
    providerRef: "cs_test_abc",
    status: "paid",
    amountTotalCents: 2480,
    currency: "eur",
    orderId: ORDER_ID,
    ...overrides,
  };
}

describe("PaymentsService", () => {
  let service: PaymentsService;
  let provider: jest.Mocked<PaymentProvider> & { mode: string };
  let prisma: {
    order: { findUnique: jest.Mock; updateMany: jest.Mock };
    payment: {
      create: jest.Mock;
      update: jest.Mock;
      updateMany: jest.Mock;
      findUnique: jest.Mock;
      findMany: jest.Mock;
    };
    $transaction: jest.Mock;
  };

  beforeEach(() => {
    provider = {
      name: "stripe",
      mode: "test",
      createCheckout: jest.fn().mockResolvedValue({
        providerRef: "cs_test_new",
        redirectUrl: "https://checkout.stripe.com/c/pay/cs_test_new",
      }),
      getCheckout: jest.fn(),
      expireCheckout: jest.fn().mockResolvedValue(undefined),
      parseWebhook: jest.fn(),
    } as never;
    prisma = {
      order: { findUnique: jest.fn(), updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      payment: {
        create: jest.fn().mockResolvedValue(makePayment({ providerRef: null })),
        update: jest.fn().mockResolvedValue({}),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUnique: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
      },
      $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
    };
    const config = { get: jest.fn(() => "https://app.example") } as unknown as ConfigService;
    service = new PaymentsService(prisma as unknown as PrismaService, provider, config);
  });

  describe("startCheckout", () => {
    it("charges the stored order total with server-side prices", async () => {
      prisma.order.findUnique.mockResolvedValue(makeOrder());

      const result = await service.startCheckout("u1", ORDER_ID);

      expect(prisma.payment.create).toHaveBeenCalledWith({
        data: { orderId: ORDER_ID, provider: "stripe", amountCents: 2480, currency: "eur" },
      });
      const request = provider.createCheckout.mock.calls[0][0];
      expect(request.lines).toEqual([
        { name: "Bowl κοτόπουλο & κινόα", unitAmountCents: 850, quantity: 2 },
        { name: "Buddha bowl λαχανικών", unitAmountCents: 780, quantity: 1 },
      ]);
      expect(request.successUrl).toBe(
        `https://app.example/?checkout=success&order=${ORDER_ID}&session_id={CHECKOUT_SESSION_ID}`,
      );
      expect(prisma.payment.update).toHaveBeenCalledWith({
        where: { id: "p1" },
        data: { providerRef: "cs_test_new" },
      });
      expect(result.checkoutUrl).toContain("checkout.stripe.com");
    });

    it("is unavailable when no payment provider is configured", async () => {
      provider.mode = "disabled";
      await expect(service.startCheckout("u1", ORDER_ID)).rejects.toBeInstanceOf(
        ServiceUnavailableException,
      );
    });

    it("refuses someone else's order", async () => {
      prisma.order.findUnique.mockResolvedValue(makeOrder({ userId: "someone-else" }));
      await expect(service.startCheckout("u1", ORDER_ID)).rejects.toBeInstanceOf(ForbiddenException);
      expect(provider.createCheckout).not.toHaveBeenCalled();
    });

    it("refuses an order that is no longer awaiting payment", async () => {
      prisma.order.findUnique.mockResolvedValue(makeOrder({ status: "confirmed" }));
      await expect(service.startCheckout("u1", ORDER_ID)).rejects.toBeInstanceOf(ConflictException);
    });

    it("closes an earlier open attempt before opening a new one (no double charge)", async () => {
      prisma.order.findUnique.mockResolvedValue(makeOrder());
      prisma.payment.findMany.mockResolvedValue([makePayment({ id: "old", providerRef: "cs_test_old" })]);

      await service.startCheckout("u1", ORDER_ID);

      expect(provider.expireCheckout).toHaveBeenCalledWith("cs_test_old");
      expect(prisma.payment.updateMany).toHaveBeenCalledWith({
        where: { id: "old", status: "pending" },
        data: { status: "cancelled" },
      });
      expect(provider.createCheckout).toHaveBeenCalledTimes(1);
    });

    it("stops if the earlier attempt turns out to be paid already", async () => {
      prisma.order.findUnique
        .mockResolvedValueOnce(makeOrder())
        .mockResolvedValueOnce(makeOrder({ status: "confirmed" }));
      prisma.payment.findMany.mockResolvedValue([makePayment({ id: "old", providerRef: "cs_test_old" })]);
      provider.expireCheckout.mockRejectedValue(new Error("session is complete"));
      provider.getCheckout.mockResolvedValue(paidInfo({ providerRef: "cs_test_old" }));

      await expect(service.startCheckout("u1", ORDER_ID)).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.$transaction).toHaveBeenCalled();
      expect(provider.createCheckout).not.toHaveBeenCalled();
    });

    it("marks the attempt failed if the provider call fails", async () => {
      prisma.order.findUnique.mockResolvedValue(makeOrder());
      provider.createCheckout.mockRejectedValue(new Error("network"));

      await expect(service.startCheckout("u1", ORDER_ID)).rejects.toBeInstanceOf(
        ServiceUnavailableException,
      );
      expect(prisma.payment.update).toHaveBeenCalledWith({
        where: { id: "p1" },
        data: { status: "failed" },
      });
    });
  });

  describe("confirmReturn", () => {
    beforeEach(() => {
      prisma.order.findUnique.mockResolvedValue(makeOrder({ status: "confirmed" }));
    });

    it("confirms the order when the session is paid and matches", async () => {
      prisma.payment.findUnique.mockResolvedValue({ ...makePayment(), order: makeOrder() });
      provider.getCheckout.mockResolvedValue(paidInfo());

      await service.confirmReturn("u1", "cs_test_abc");

      expect(prisma.payment.updateMany).toHaveBeenCalledWith({
        where: { id: "p1", status: "pending" },
        data: { status: "succeeded" },
      });
      expect(prisma.order.updateMany).toHaveBeenCalledWith({
        where: { id: ORDER_ID, status: "pending" },
        data: { status: "confirmed" },
      });
    });

    it("does not confirm when the paid amount doesn't match the order", async () => {
      prisma.payment.findUnique.mockResolvedValue({ ...makePayment(), order: makeOrder() });
      provider.getCheckout.mockResolvedValue(paidInfo({ amountTotalCents: 1 }));

      await service.confirmReturn("u1", "cs_test_abc");

      expect(prisma.order.updateMany).not.toHaveBeenCalled();
      expect(prisma.payment.updateMany).toHaveBeenCalledWith({
        where: { id: "p1", status: "pending" },
        data: { status: "failed" },
      });
    });

    it("leaves an unfinished session pending", async () => {
      prisma.payment.findUnique.mockResolvedValue({ ...makePayment(), order: makeOrder() });
      provider.getCheckout.mockResolvedValue(paidInfo({ status: "open" }));

      await service.confirmReturn("u1", "cs_test_abc");

      expect(prisma.payment.updateMany).not.toHaveBeenCalled();
      expect(prisma.order.updateMany).not.toHaveBeenCalled();
    });

    it("refuses a session belonging to another customer", async () => {
      prisma.payment.findUnique.mockResolvedValue({
        ...makePayment(),
        order: makeOrder({ userId: "someone-else" }),
      });
      await expect(service.confirmReturn("u1", "cs_test_abc")).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(provider.getCheckout).not.toHaveBeenCalled();
    });
  });

  describe("handleWebhook", () => {
    it("rejects a payload whose signature doesn't verify", async () => {
      provider.parseWebhook.mockImplementation(() => {
        throw new Error("No signatures found matching the expected signature");
      });
      await expect(service.handleWebhook(Buffer.from("{}"), "t=1,v1=bad")).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it("marks an expired session's attempt as cancelled", async () => {
      provider.parseWebhook.mockReturnValue(paidInfo({ status: "expired" }));
      prisma.payment.findUnique.mockResolvedValue(makePayment());

      await service.handleWebhook(Buffer.from("{}"), "sig");

      expect(prisma.payment.updateMany).toHaveBeenCalledWith({
        where: { id: "p1", status: "pending" },
        data: { status: "cancelled" },
      });
      expect(prisma.order.updateMany).not.toHaveBeenCalled();
    });

    it("ignores event types it doesn't handle", async () => {
      provider.parseWebhook.mockReturnValue(null);
      await service.handleWebhook(Buffer.from("{}"), "sig");
      expect(prisma.payment.findUnique).not.toHaveBeenCalled();
    });
  });
});
