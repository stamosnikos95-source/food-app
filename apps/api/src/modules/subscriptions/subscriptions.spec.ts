import { BadRequestException, ConflictException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { mealCredits } from "./meal-credits";
import { isUsable, SubscriptionsService } from "./subscriptions.service";

describe("mealCredits", () => {
  it("covers the most expensive portions first, each up to the plan's cap", () => {
    // portions 9.80, 8.50, 8.50, 7.00; 2 credits, cap 9.00 -> 9.00 + 8.50
    const lines = [{ unitPriceCents: 850, quantity: 2 }, { unitPriceCents: 980, quantity: 1 }, { unitPriceCents: 700, quantity: 1 }];
    expect(mealCredits(lines, 2, 900)).toEqual({ meals: 2, cents: 1750 });
  });
  it("never uses more credits than there are portions", () => {
    expect(mealCredits([{ unitPriceCents: 850, quantity: 1 }], 5, 900)).toEqual({ meals: 1, cents: 850 });
  });
});

describe("SubscriptionsService", () => {
  const now = new Date("2026-10-01T10:00:00Z");
  const plan = { id: "p1", mealsPerPeriod: 10, periodDays: 30, maxMealPriceCents: 900, isActive: true };
  const active = (mealsRemaining: number, end = "2026-10-20T00:00:00Z") =>
    ({ id: "s1", status: "active", mealsRemaining, currentPeriodEnd: new Date(end), plan });

  const txWith = (sub: unknown) => ({
    $queryRaw: jest.fn().mockResolvedValue(sub ? [{ id: "s1" }] : []),
    subscription: { findUnique: jest.fn().mockResolvedValue(sub), update: jest.fn() },
  });
  const service = new SubscriptionsService({} as never);

  it("spends credits under a row lock and decrements what's left", async () => {
    const tx = txWith(active(3));
    const r = await service.claimMeals(tx as never, "u1", 2, [{ unitPriceCents: 850, quantity: 2 }], now);
    expect(r).toEqual({ subscriptionId: "s1", meals: 2, cents: 1700 });
    expect((tx.$queryRaw.mock.calls[0][0] as TemplateStringsArray).join("?")).toContain("FOR UPDATE");
    expect(tx.subscription.update).toHaveBeenCalledWith({ where: { id: "s1" }, data: { mealsRemaining: { decrement: 2 } } });
  });

  it("refuses without an active plan, after the period ends, or without enough meals", async () => {
    const lines = [{ unitPriceCents: 850, quantity: 2 }];
    await expect(service.claimMeals(txWith(null) as never, "u1", 1, lines, now)).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.claimMeals(txWith(active(5, "2026-09-30T00:00:00Z")) as never, "u1", 1, lines, now)).rejects.toBeInstanceOf(BadRequestException);
    const short = txWith(active(1));
    await expect(service.claimMeals(short as never, "u1", 2, lines, now)).rejects.toBeInstanceOf(BadRequestException);
    expect(short.subscription.update).not.toHaveBeenCalled();
  });

  it("activation (payment received) starts a full period; renewal resets it", async () => {
    const update = jest.fn((args) => ({ ...args.data }));
    const svc = (sub: unknown) => new SubscriptionsService({ subscription: { findUnique: jest.fn().mockResolvedValue(sub), update } } as never);
    const first = await svc({ id: "s1", status: "pending", activatedAt: null, plan }).activate("s1", now);
    expect(first.renewal).toBe(false);
    expect(update.mock.calls[0][0].data).toMatchObject({ status: "active", mealsRemaining: 10, currentPeriodEnd: new Date("2026-10-31T10:00:00Z") });
    const renewed = await svc({ ...active(2), activatedAt: new Date("2026-09-01T00:00:00Z") }).activate("s1", now);
    expect(renewed.renewal).toBe(true);
    expect(update.mock.calls[1][0].data).toMatchObject({ mealsRemaining: 10, activatedAt: new Date("2026-09-01T00:00:00Z") });
  });

  it("allows one open subscription per customer (enforced by the database)", async () => {
    const prisma = {
      subscriptionPlan: { findUnique: jest.fn().mockResolvedValue(plan) },
      subscription: { create: jest.fn().mockRejectedValue(new Prisma.PrismaClientKnownRequestError("dup", { code: "P2002", clientVersion: "5" })) },
    };
    await expect(new SubscriptionsService(prisma as never).request("u1", "p1")).rejects.toBeInstanceOf(ConflictException);
  });

  it("gives credits back on cancellation only while the plan is still running", async () => {
    const db = { subscription: { updateMany: jest.fn() } };
    await service.releaseMeals(db as never, { subscriptionId: "s1", subscriptionMeals: 2 }, now);
    expect(db.subscription.updateMany).toHaveBeenCalledWith({
      where: { id: "s1", status: "active", currentPeriodEnd: { gt: now } },
      data: { mealsRemaining: { increment: 2 } },
    });
    expect(isUsable({ status: "pending", currentPeriodEnd: null }, now)).toBe(false);
  });
});
