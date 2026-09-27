import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Order, Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { mealCredits } from "./meal-credits";

type Db = Prisma.TransactionClient;
const DAY_MS = 24 * 60 * 60 * 1000;
const isUniqueViolation = (e: unknown) => e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";

/** Active and inside its paid period. */
export const isUsable = (s: { status: string; currentPeriodEnd: Date | null }, now = new Date()) =>
  s.status === "active" && s.currentPeriodEnd !== null && s.currentPeriodEnd.getTime() > now.getTime();

@Injectable()
export class SubscriptionsService {
  constructor(private readonly prisma: PrismaService) {}

  plans() {
    return this.prisma.subscriptionPlan.findMany({ where: { isActive: true }, orderBy: { priceCents: "asc" } });
  }

  /** The customer's open subscription, else their latest one. */
  async mine(userId: string, now = new Date()) {
    const sub =
      (await this.prisma.subscription.findFirst({ where: { userId, status: { in: ["pending", "active"] } }, include: { plan: true } })) ??
      (await this.prisma.subscription.findFirst({ where: { userId }, orderBy: { createdAt: "desc" }, include: { plan: true } }));
    return { subscription: sub ? { ...sub, usable: isUsable(sub, now), expired: sub.status === "active" && !isUsable(sub, now) } : null };
  }

  /** Customer asks for a plan; it becomes active once paid (at the store for now). */
  async request(userId: string, planId: string) {
    const plan = await this.prisma.subscriptionPlan.findUnique({ where: { id: planId } });
    if (!plan || !plan.isActive) throw new NotFoundException("Plan not available");
    try {
      return await this.prisma.subscription.create({ data: { userId, planId }, include: { plan: true } });
    } catch (error) {
      if (isUniqueViolation(error)) throw new ConflictException("You already have an open subscription");
      throw error;
    }
  }

  async cancelPending(userId: string) {
    const r = await this.prisma.subscription.updateMany({ where: { userId, status: "pending" }, data: { status: "cancelled" } });
    if (r.count === 0) throw new NotFoundException("No pending subscription to cancel");
    return this.mine(userId);
  }

  /** Inside the order transaction: row-locks the subscription and spends credits. */
  async claimMeals(tx: Db, userId: string, requested: number, lines: { unitPriceCents: number; quantity: number }[], now = new Date()) {
    const locked = await tx.$queryRaw<{ id: string }[]>`
      SELECT "id" FROM "subscriptions" WHERE "userId" = ${userId} AND "status" = 'active' FOR UPDATE`;
    const sub = locked.length ? await tx.subscription.findUnique({ where: { id: locked[0].id }, include: { plan: true } }) : null;
    if (!sub || !isUsable(sub, now)) throw new BadRequestException("No active meal plan");
    const credit = mealCredits(lines, requested, sub.plan.maxMealPriceCents);
    if (credit.meals > sub.mealsRemaining) throw new BadRequestException("Not enough meals left in the plan");
    await tx.subscription.update({ where: { id: sub.id }, data: { mealsRemaining: { decrement: credit.meals } } });
    return { subscriptionId: sub.id, meals: credit.meals, cents: credit.cents };
  }

  /** On cancellation: gives the credits back if the plan is still running. */
  async releaseMeals(db: Db, order: Pick<Order, "subscriptionId" | "subscriptionMeals">, now = new Date()) {
    if (!order.subscriptionId || order.subscriptionMeals <= 0) return;
    await db.subscription.updateMany({
      where: { id: order.subscriptionId, status: "active", currentPeriodEnd: { gt: now } },
      data: { mealsRemaining: { increment: order.subscriptionMeals } },
    });
  }

  // ---- admin -------------------------------------------------------------

  listPlans() {
    return this.prisma.subscriptionPlan.findMany({ orderBy: [{ isActive: "desc" }, { priceCents: "asc" }] });
  }

  createPlan(data: Prisma.SubscriptionPlanCreateInput) {
    return this.prisma.subscriptionPlan.create({ data });
  }

  async updatePlan(id: string, data: Prisma.SubscriptionPlanUpdateInput) {
    const found = await this.prisma.subscriptionPlan.findUnique({ where: { id } });
    if (!found) throw new NotFoundException("Plan not found");
    return this.prisma.subscriptionPlan.update({ where: { id }, data });
  }

  list(status?: "pending" | "active" | "cancelled") {
    return this.prisma.subscription.findMany({
      where: status ? { status } : {},
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      take: 200,
      include: { plan: true, user: { select: { email: true } } },
    });
  }

  /**
   * Payment received (at the store): starts the plan, or renews it for a new
   * period. Credits don't roll over — a new period starts with a full plan.
   */
  async activate(id: string, now = new Date()) {
    const sub = await this.prisma.subscription.findUnique({ where: { id }, include: { plan: true } });
    if (!sub) throw new NotFoundException("Subscription not found");
    if (sub.status === "cancelled") throw new ConflictException("Cancelled subscriptions can't be activated");
    const renewal = sub.status === "active";
    const updated = await this.prisma.subscription.update({
      where: { id },
      data: {
        status: "active",
        mealsRemaining: sub.plan.mealsPerPeriod,
        activatedAt: sub.activatedAt ?? now,
        lastPaidAt: now,
        currentPeriodEnd: new Date(now.getTime() + sub.plan.periodDays * DAY_MS),
      },
      include: { plan: true, user: { select: { email: true } } },
    });
    return { subscription: updated, renewal };
  }

  async cancel(id: string) {
    const r = await this.prisma.subscription.updateMany({ where: { id, status: { in: ["pending", "active"] } }, data: { status: "cancelled" } });
    if (r.count === 0) throw new NotFoundException("No open subscription with this id");
    return this.prisma.subscription.findUniqueOrThrow({ where: { id }, include: { plan: true, user: { select: { email: true } } } });
  }
}
