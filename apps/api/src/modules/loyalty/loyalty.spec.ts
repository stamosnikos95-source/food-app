import { BadRequestException } from "@nestjs/common";
import { customerPaidCents, LoyaltyService } from "./loyalty.service";

const config = { get: jest.fn((k: string) => ({ LOYALTY_POINTS_PER_EURO: 1, LOYALTY_REWARD_POINTS: 100, LOYALTY_REWARD_VALUE_CENTS: 500 })[k]) };
const service = new LoyaltyService({} as never, config as never);
const order = (o: Partial<Parameters<typeof customerPaidCents>[0]> = {}) => ({
  id: "o1", userId: "u1", totalPriceCents: 1700, companyPaidCents: 0, subscriptionCoveredCents: 0, loyaltyDiscountCents: 0, loyaltyPointsRedeemed: 0, ...o,
});

describe("LoyaltyService", () => {
  const txWithBalance = (points: number) => ({
    $queryRaw: jest.fn().mockResolvedValue([{ id: "u1" }]),
    loyaltyEntry: { aggregate: jest.fn().mockResolvedValue({ _sum: { points } }), createMany: jest.fn().mockResolvedValue({ count: 1 }) },
  });

  it("prices one reward under a lock, never more than what's left to pay", async () => {
    const tx = txWithBalance(130);
    expect(await service.prepareRedemption(tx as never, "u1", 1200)).toEqual({ points: 100, cents: 500 });
    expect(await service.prepareRedemption(tx as never, "u1", 300)).toEqual({ points: 100, cents: 300 });
    expect((tx.$queryRaw.mock.calls[0][0] as TemplateStringsArray).join("?")).toContain("FOR UPDATE");
  });

  it("refuses without enough points, or when nothing is left to pay", async () => {
    await expect(service.prepareRedemption(txWithBalance(99) as never, "u1", 1200)).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.prepareRedemption(txWithBalance(500) as never, "u1", 0)).rejects.toBeInstanceOf(BadRequestException);
  });

  it("awards points on what the customer paid themselves, idempotently", async () => {
    const tx = txWithBalance(0);
    // 17.00 total - 4.00 employer - 5.00 reward = 8.00 paid -> 8 points
    expect(await service.awardForCompletedOrder(tx as never, order({ companyPaidCents: 400, loyaltyDiscountCents: 500 }))).toBe(8);
    expect(tx.loyaltyEntry.createMany).toHaveBeenCalledWith({
      data: [{ userId: "u1", orderId: "o1", type: "earn", points: 8 }], skipDuplicates: true,
    });
    tx.loyaltyEntry.createMany.mockResolvedValue({ count: 0 }); // already awarded
    expect(await service.awardForCompletedOrder(tx as never, order())).toBe(0);
    expect(await service.awardForCompletedOrder(tx as never, order({ companyPaidCents: 1700 }))).toBe(0);
  });

  it("gives back redeemed points when an order is cancelled", async () => {
    const tx = txWithBalance(0);
    await service.reverseRedemption(tx as never, order({ loyaltyPointsRedeemed: 100 }));
    expect(tx.loyaltyEntry.createMany).toHaveBeenCalledWith({
      data: [{ userId: "u1", orderId: "o1", type: "reversal", points: 100 }], skipDuplicates: true,
    });
    tx.loyaltyEntry.createMany.mockClear();
    await service.reverseRedemption(tx as never, order());
    expect(tx.loyaltyEntry.createMany).not.toHaveBeenCalled();
  });
});
