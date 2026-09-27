import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { businessDay } from "./business-time";

@Injectable()
export class CompanyAllowanceService {
  constructor(private readonly prisma: PrismaService) {}

  /** What the customer app shows before checkout; null when nothing applies. */
  async statusFor(userId: string, now = new Date()) {
    const member = await this.prisma.companyMember.findUnique({ where: { userId }, include: { company: true } });
    if (!member || !member.company.isActive || member.company.dailyAllowanceCents <= 0) return null;
    const used = await this.usedToday(this.prisma, userId, member.companyId, now);
    const allowance = member.company.dailyAllowanceCents;
    return {
      companyName: member.company.name,
      dailyAllowanceCents: allowance,
      usedTodayCents: used,
      remainingTodayCents: Math.max(0, allowance - used),
    };
  }

  /**
   * Called inside the order-creation transaction. Row-locks the membership
   * so two orders placed at the same moment can't both spend the same
   * allowance; the second waits and sees the first one's claim.
   */
  async claimForOrder(tx: Prisma.TransactionClient, userId: string, orderTotalCents: number, now = new Date()) {
    const locked = await tx.$queryRaw<{ id: string }[]>`
      SELECT "id" FROM "company_members" WHERE "userId" = ${userId} FOR UPDATE`;
    if (locked.length === 0) return { companyId: null, cents: 0 };

    const member = await tx.companyMember.findUnique({ where: { userId }, include: { company: true } });
    if (!member || !member.company.isActive || member.company.dailyAllowanceCents <= 0) {
      return { companyId: null, cents: 0 };
    }
    const used = await this.usedToday(tx, userId, member.companyId, now);
    const cents = Math.min(Math.max(0, member.company.dailyAllowanceCents - used), orderTotalCents);
    return { companyId: cents > 0 ? member.companyId : null, cents };
  }

  /** Cancelled orders don't count, so cancelling gives the allowance back. */
  private async usedToday(db: Prisma.TransactionClient, userId: string, companyId: string, now: Date) {
    const { start, end } = businessDay(now);
    const agg = await db.order.aggregate({
      where: { userId, companyId, status: { not: "cancelled" }, createdAt: { gte: start, lt: end } },
      _sum: { companyPaidCents: true },
    });
    return agg._sum.companyPaidCents ?? 0;
  }
}
