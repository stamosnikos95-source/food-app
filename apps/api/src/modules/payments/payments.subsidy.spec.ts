import { ConflictException } from "@nestjs/common";
import { PaymentsService } from "./payments.service";

function setup(totalPriceCents: number, companyPaidCents: number) {
  const order = {
    id: "o1", userId: "u1", status: "pending", totalPriceCents, companyPaidCents,
    user: { email: "a@acme.gr" },
    items: [{ quantity: 1, unitPriceCents: totalPriceCents, menuItem: { name: "Bowl" } }],
  };
  const prisma = {
    order: { findUnique: jest.fn().mockResolvedValue(order) },
    payment: {
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockResolvedValue({ id: "pay1" }),
      update: jest.fn(),
    },
  };
  const provider = {
    name: "stripe", mode: "test",
    createCheckout: jest.fn().mockResolvedValue({ providerRef: "cs_1", redirectUrl: "https://checkout.example" }),
    expireCheckout: jest.fn(), getCheckout: jest.fn(), parseWebhook: jest.fn(),
  };
  const config = { get: jest.fn(() => "https://app.example") };
  return { prisma, provider, service: new PaymentsService(prisma as never, provider as never, config as never) };
}

describe("PaymentsService.startCheckout with an employer subsidy", () => {
  it("charges only the employee's share, as one line", async () => {
    const { service, prisma, provider } = setup(850, 500);
    await service.startCheckout("u1", "o1");
    expect(prisma.payment.create.mock.calls[0][0].data.amountCents).toBe(350);
    const request = provider.createCheckout.mock.calls[0][0];
    expect(request.lines).toEqual([
      { name: "Παραγγελία (υπόλοιπο μετά την εταιρική επιδότηση)", unitAmountCents: 350, quantity: 1 },
    ]);
  });

  it("refuses checkout when the company covers everything, or the rest is below the card minimum", async () => {
    await expect(setup(850, 850).service.startCheckout("u1", "o1")).rejects.toBeInstanceOf(ConflictException);
    const small = setup(850, 820);
    await expect(small.service.startCheckout("u1", "o1")).rejects.toBeInstanceOf(ConflictException);
    expect(small.provider.createCheckout).not.toHaveBeenCalled();
  });

  it("keeps itemised lines when there is no subsidy", async () => {
    const { service, provider } = setup(850, 0);
    await service.startCheckout("u1", "o1");
    expect(provider.createCheckout.mock.calls[0][0].lines).toEqual([{ name: "Bowl", unitAmountCents: 850, quantity: 1 }]);
  });
});
