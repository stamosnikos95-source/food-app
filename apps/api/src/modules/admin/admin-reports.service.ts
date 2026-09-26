import { BadRequestException, Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

const MAX_RANGE_MS = 92 * 24 * 60 * 60 * 1000;

@Injectable()
export class AdminReportsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Sales summary for [from, to). Aggregation happens in Postgres, not in memory. */
  async summary(fromIso: string, toIso: string) {
    const from = new Date(fromIso);
    const to = new Date(toIso);
    if (!(to > from)) throw new BadRequestException("`to` must be after `from`");
    if (to.getTime() - from.getTime() > MAX_RANGE_MS) {
      throw new BadRequestException("Range can't exceed 92 days");
    }
    const createdAt = { gte: from, lt: to };

    const [byStatus, sales, paidOnline, top] = await Promise.all([
      this.prisma.order.groupBy({ by: ["status"], where: { createdAt }, _count: { _all: true } }),
      this.prisma.order.aggregate({
        where: { createdAt, status: { not: "cancelled" } },
        _sum: { totalPriceCents: true },
        _count: { _all: true },
      }),
      this.prisma.payment.aggregate({
        where: { createdAt, status: "succeeded" },
        _sum: { amountCents: true },
      }),
      this.prisma.orderItem.groupBy({
        by: ["menuItemId"],
        where: { order: { createdAt, status: { not: "cancelled" } } },
        _sum: { quantity: true },
        orderBy: { _sum: { quantity: "desc" } },
        take: 5,
      }),
    ]);

    const names = await this.prisma.menuItem.findMany({
      where: { id: { in: top.map((t) => t.menuItemId) } },
      select: { id: true, name: true },
    });
    const nameOf = new Map(names.map((n) => [n.id, n.name]));

    const orders = sales._count._all;
    const revenueCents = sales._sum.totalPriceCents ?? 0;
    return {
      from: from.toISOString(),
      to: to.toISOString(),
      orders,
      revenueCents,
      averageOrderCents: orders > 0 ? Math.round(revenueCents / orders) : 0,
      paidOnlineCents: paidOnline._sum.amountCents ?? 0,
      byStatus: Object.fromEntries(byStatus.map((s) => [s.status, s._count._all])),
      topItems: top.map((t) => ({
        menuItemId: t.menuItemId,
        name: nameOf.get(t.menuItemId) ?? "—",
        quantity: t._sum.quantity ?? 0,
      })),
    };
  }
}
