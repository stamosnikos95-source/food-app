import { BadRequestException, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Order, Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";

type Db = Prisma.TransactionClient;
type OrderMoney = Pick<Order, "id" | "userId" | "totalPriceCents" | "companyPaidCents" | "subscriptionCoveredCents" | "loyaltyDiscountCents" | "loyaltyPointsRedeemed">;

/** What the customer actually paid, after every discount. */
export const customerPaidCents = (o: OrderMoney) =>
  o.totalPriceCents - o.companyPaidCents - o.subscriptionCoveredCents - o.loyaltyDiscountCents;

@Injectable()
export class LoyaltyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  get rules() {
    return {
      pointsPerEuro: this.config.get<number>("LOYALTY_POINTS_PER_EURO") ?? 1,
      rewardPoints: this.config.get<number>("LOYALTY_REWARD_POINTS") ?? 100,
      rewardValueCents: this.config.get<number>("LOYALTY_REWARD_VALUE_CENTS") ?? 500,
    };
  }

  async balance(db: Db, userId: string): Promise<number> {
    const agg = await db.loyaltyEntry.aggregate({ where: { userId }, _sum: { points: true } });
    return agg._sum.points ?? 0;
  }

  /** The customer's points, progress to the next reward and recent history. */
  async summary(userId: string) {
    const [balance, history] = await Promise.all([
      this.balance(this.prisma, userId),
      this.prisma.loyaltyEntry.findMany({
        where: { userId }, orderBy: { createdAt: "desc" }, take: 20,
        select: { id: true, type: true, points: true, orderId: true, note: true, createdAt: true },
      }),
    ]);
    const rules = this.rules;
    return { balance, ...rules, canRedeem: balance >= rules.rewardPoints, pointsToNextReward: Math.max(0, rules.rewardPoints - balance), history };
  }

  /**
   * Inside the order transaction: row-locks the customer so two orders
   * placed at once can't spend the same points, then prices one reward.
   */
  async prepareRedemption(tx: Db, userId: string, payableCents: number) {
    await tx.$queryRaw`SELECT "id" FROM "users" WHERE "id" = ${userId} FOR UPDATE`;
    const { rewardPoints, rewardValueCents } = this.rules;
    if (payableCents <= 0) throw new BadRequestException("Nothing left to pay on this order");
    if ((await this.balance(tx, userId)) < rewardPoints) throw new BadRequestException("Not enough points for a reward");
    return { points: rewardPoints, cents: Math.min(rewardValueCents, payableCents) };
  }

  recordRedemption(tx: Db, userId: string, orderId: string, points: number) {
    return tx.loyaltyEntry.create({ data: { userId, orderId, type: "redeem", points: -points } });
  }

  /**
   * On pickup. Idempotent: the (orderId, type) unique key plus skipDuplicates
   * means a repeated call can't award twice, and never aborts the transaction.
   */
  async awardForCompletedOrder(db: Db, order: OrderMoney): Promise<number> {
    const points = Math.floor((customerPaidCents(order) * this.rules.pointsPerEuro) / 100);
    if (points <= 0) return 0;
    const created = await db.loyaltyEntry.createMany({
      data: [{ userId: order.userId, orderId: order.id, type: "earn", points }],
      skipDuplicates: true,
    });
    return created.count > 0 ? points : 0;
  }

  /** On cancellation: gives back points spent on the order (once). */
  async reverseRedemption(db: Db, order: OrderMoney) {
    if (order.loyaltyPointsRedeemed <= 0) return;
    await db.loyaltyEntry.createMany({
      data: [{ userId: order.userId, orderId: order.id, type: "reversal", points: order.loyaltyPointsRedeemed }],
      skipDuplicates: true,
    });
  }

  /** Goodwill / corrections by staff; always attributed. */
  adjust(userId: string, points: number, note: string, actorId: string) {
    return this.prisma.loyaltyEntry.create({ data: { userId, type: "adjustment", points, note, actorId } });
  }
}
