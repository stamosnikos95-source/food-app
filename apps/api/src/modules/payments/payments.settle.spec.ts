import { ConfigService } from "@nestjs/config";
import { PaymentsService } from "./payments.service";
import { PrismaService } from "../../prisma/prisma.service";
import { PaymentProvider } from "./providers/payment-provider";

describe("PaymentsService.settleBeforeCancel", () => {
  const attempt = { id: "p1", orderId: "o1", status: "pending", providerRef: "cs_1", amountCents: 850, currency: "eur" };
  let prisma: { payment: { findMany: jest.Mock; updateMany: jest.Mock; count: jest.Mock };
                order: { updateMany: jest.Mock }; $transaction: jest.Mock };
  let provider: { expireCheckout: jest.Mock; getCheckout: jest.Mock; mode: string; name: string };
  let service: PaymentsService;

  beforeEach(() => {
    prisma = { payment: { findMany: jest.fn().mockResolvedValue([attempt]), updateMany: jest.fn(), count: jest.fn() },
      order: { updateMany: jest.fn() }, $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)) };
    provider = { expireCheckout: jest.fn(), getCheckout: jest.fn(), mode: "test", name: "stripe" };
    service = new PaymentsService(prisma as unknown as PrismaService,
      provider as unknown as PaymentProvider, { get: () => undefined } as unknown as ConfigService);
  });

  it("closes open checkouts so a cancelled order can't be paid later", async () => {
    prisma.payment.count.mockResolvedValue(0);
    await expect(service.settleBeforeCancel("o1")).resolves.toEqual({ paid: false });
    expect(provider.expireCheckout).toHaveBeenCalledWith("cs_1");
    expect(prisma.payment.updateMany).toHaveBeenCalledWith({
      where: { id: "p1", status: "pending" }, data: { status: "cancelled" } });
  });

  it("detects a checkout that got paid just before it could be closed", async () => {
    provider.expireCheckout.mockRejectedValue(new Error("session already complete"));
    provider.getCheckout.mockResolvedValue({ providerRef: "cs_1", status: "paid", amountTotalCents: 850,
      currency: "eur", orderId: "o1" });
    prisma.payment.count.mockResolvedValue(1);

    await expect(service.settleBeforeCancel("o1")).resolves.toEqual({ paid: true });
    expect(prisma.$transaction).toHaveBeenCalled();
  });
});
