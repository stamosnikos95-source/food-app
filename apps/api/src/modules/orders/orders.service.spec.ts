import { BadRequestException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { OrdersService } from "./orders.service";
import { PrismaService } from "../../prisma/prisma.service";

describe("OrdersService", () => {
  let service: OrdersService;
  let prisma: {
    menuItem: { findMany: jest.Mock };
    order: { create: jest.Mock; findMany: jest.Mock; findUnique: jest.Mock };
    $transaction: jest.Mock;
    recommendationEvent: { updateMany: jest.Mock };
  };
  let allowance: { claimForOrder: jest.Mock };
  let subscriptions: { claimMeals: jest.Mock };
  let loyalty: { prepareRedemption: jest.Mock; recordRedemption: jest.Mock };
  let gyms: { resolveForOrder: jest.Mock };

  beforeEach(() => {
    prisma = {
      menuItem: { findMany: jest.fn() },
      order: { create: jest.fn(), findMany: jest.fn(), findUnique: jest.fn() },
      $transaction: jest.fn(),
      recommendationEvent: { updateMany: jest.fn() },
    };
    // The transaction callback runs against the same mock client.
    prisma.$transaction.mockImplementation((fn: (tx: unknown) => unknown) => fn(prisma));
    allowance = { claimForOrder: jest.fn().mockResolvedValue({ companyId: null, cents: 0 }) };
    subscriptions = { claimMeals: jest.fn() };
    loyalty = { prepareRedemption: jest.fn(), recordRedemption: jest.fn() };
    gyms = { resolveForOrder: jest.fn() };
    service = new OrdersService(prisma as unknown as PrismaService, allowance as never, subscriptions as never, loyalty as never, gyms as never);
  });

  describe("create", () => {
    it("marks today's recommendations that became this order", async () => {
      prisma.menuItem.findMany.mockResolvedValue([{ id: "m1", priceCents: 850, isActive: true }]);
      prisma.order.create.mockResolvedValue({ id: "o5" });
      await service.create("u1", { items: [{ menuItemId: "m1", quantity: 1 }] });
      expect(prisma.recommendationEvent.updateMany).toHaveBeenCalledWith({
        where: expect.objectContaining({ userId: "u1", menuItemId: { in: ["m1"] }, orderId: null }),
        data: expect.objectContaining({ orderId: "o5" }),
      });
    });

    it("applies the gym member discount after the employer subsidy and before points", async () => {
      prisma.menuItem.findMany.mockResolvedValue([{ id: "m1", priceCents: 1000, isActive: true }]);
      prisma.order.create.mockResolvedValue({ id: "o7" });
      gyms.resolveForOrder.mockResolvedValue({ gymId: "g1", qrCodeId: "q1", discountPercent: 10 });
      allowance.claimForOrder.mockResolvedValue({ companyId: "c1", cents: 200 });
      loyalty.prepareRedemption.mockResolvedValue({ points: 100, cents: 500 });

      await service.create("u1", { items: [{ menuItemId: "m1", quantity: 1 }], gymCode: "abc234defg", fulfillment: "gym", redeemPoints: true });

      // 10.00 -> employer 2.00 -> member discount 10% of 8.00 = 0.80 -> points see 7.20
      expect(gyms.resolveForOrder).toHaveBeenCalledWith(prisma, "abc234defg", "gym");
      expect(loyalty.prepareRedemption).toHaveBeenCalledWith(prisma, "u1", 720);
      expect(prisma.order.create.mock.calls[0][0].data).toMatchObject({
        gymId: "g1", gymQrCodeId: "q1", gymDiscountCents: 80, fulfillment: "gym", companyPaidCents: 200,
      });
    });

    it("refuses delivery to a gym without a gym code", async () => {
      prisma.menuItem.findMany.mockResolvedValue([{ id: "m1", priceCents: 1000, isActive: true }]);
      await expect(service.create("u1", { items: [{ menuItemId: "m1", quantity: 1 }], fulfillment: "gym" })).rejects.toThrow("gym code");
      expect(prisma.order.create).not.toHaveBeenCalled();
    });

    it("applies discounts in a fixed order: meal plan, then employer, then loyalty", async () => {
      prisma.menuItem.findMany.mockResolvedValue([{ id: "m1", priceCents: 850, isActive: true }]);
      prisma.order.create.mockResolvedValue({ id: "o9" });
      subscriptions.claimMeals.mockResolvedValue({ subscriptionId: "s1", meals: 1, cents: 800 });
      allowance.claimForOrder.mockResolvedValue({ companyId: "c1", cents: 400 });
      loyalty.prepareRedemption.mockResolvedValue({ points: 100, cents: 500 });

      await service.create("u1", { items: [{ menuItemId: "m1", quantity: 2 }], subscriptionMeals: 1, redeemPoints: true });

      // 1700 total -> plan covers 800 -> employer sees 900 -> loyalty sees 500
      expect(subscriptions.claimMeals).toHaveBeenCalledWith(prisma, "u1", 1, [{ menuItemId: "m1", quantity: 2, unitPriceCents: 850 }]);
      expect(allowance.claimForOrder).toHaveBeenCalledWith(prisma, "u1", 900);
      expect(loyalty.prepareRedemption).toHaveBeenCalledWith(prisma, "u1", 500);
      expect(prisma.order.create.mock.calls[0][0].data).toMatchObject({
        totalPriceCents: 1700, subscriptionId: "s1", subscriptionMeals: 1, subscriptionCoveredCents: 800,
        companyPaidCents: 400, loyaltyPointsRedeemed: 100, loyaltyDiscountCents: 500,
      });
      expect(loyalty.recordRedemption).toHaveBeenCalledWith(prisma, "u1", "o9", 100);
    });

    it("records the employer subsidy claimed inside the same transaction", async () => {
      prisma.menuItem.findMany.mockResolvedValue([{ id: "m1", priceCents: 850, isActive: true }]);
      prisma.order.create.mockResolvedValue({ id: "o1" });
      allowance.claimForOrder.mockResolvedValue({ companyId: "c1", cents: 800 });

      await service.create("u1", { items: [{ menuItemId: "m1", quantity: 1 }] });

      expect(allowance.claimForOrder).toHaveBeenCalledWith(prisma, "u1", 850);
      const data = prisma.order.create.mock.calls[0][0].data;
      expect(data).toMatchObject({ totalPriceCents: 850, companyId: "c1", companyPaidCents: 800 });
    });

    it("prices the order from the current menu, not the request", async () => {
      prisma.menuItem.findMany.mockResolvedValue([
        { id: "m1", priceCents: 850, isActive: true },
        { id: "m2", priceCents: 500, isActive: true },
      ]);
      prisma.order.create.mockResolvedValue({ id: "o1", totalPriceCents: 2200 });

      await service.create("u1", {
        items: [
          { menuItemId: "m1", quantity: 2 },
          { menuItemId: "m2", quantity: 1 },
        ],
      });

      const call = prisma.order.create.mock.calls[0][0];
      expect(call.data.totalPriceCents).toBe(2 * 850 + 1 * 500);
      expect(call.data.items.create).toEqual([
        { menuItemId: "m1", quantity: 2, unitPriceCents: 850 },
        { menuItemId: "m2", quantity: 1, unitPriceCents: 500 },
      ]);
    });

    it("rejects an order containing an inactive or unknown item", async () => {
      prisma.menuItem.findMany.mockResolvedValue([{ id: "m1", priceCents: 850, isActive: false }]);

      await expect(
        service.create("u1", { items: [{ menuItemId: "m1", quantity: 1 }] }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe("findOne", () => {
    it("returns the order when it belongs to the requesting user", async () => {
      prisma.order.findUnique.mockResolvedValue({ id: "o1", userId: "u1" });
      const order = await service.findOne("u1", "o1");
      expect(order.id).toBe("o1");
    });

    it("throws NotFoundException when the order doesn't exist", async () => {
      prisma.order.findUnique.mockResolvedValue(null);
      await expect(service.findOne("u1", "missing")).rejects.toBeInstanceOf(NotFoundException);
    });

    it("throws ForbiddenException when the order belongs to someone else", async () => {
      prisma.order.findUnique.mockResolvedValue({ id: "o1", userId: "someone-else" });
      await expect(service.findOne("u1", "o1")).rejects.toBeInstanceOf(ForbiddenException);
    });
  });
});
