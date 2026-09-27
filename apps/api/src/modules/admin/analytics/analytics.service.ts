import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../prisma/prisma.service";
import { addDays, BUSINESS_TIME_ZONE, businessDateKey, startOfBusinessDate, weekdayOf } from "../../companies/business-time";
import { netSalesCents } from "../../gyms/gyms.service";
import { basketPairs, forecastAccuracy } from "./analytics";

const WEEKDAYS = ["Κυριακή", "Δευτέρα", "Τρίτη", "Τετάρτη", "Πέμπτη", "Παρασκευή", "Σάββατο"];

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async overview(days = 30, now = new Date()) {
    const to = businessDateKey(now);
    const from = addDays(to, -(days - 1));
    const orders = await this.prisma.order.findMany({
      where: { status: { not: "cancelled" }, createdAt: { gte: startOfBusinessDate(from), lt: startOfBusinessDate(addDays(to, 1)) } },
      select: {
        userId: true, createdAt: true, totalPriceCents: true, gymDiscountCents: true, loyaltyDiscountCents: true,
        companyPaidCents: true, subscriptionCoveredCents: true, gymId: true,
        items: { select: { menuItemId: true, quantity: true, unitPriceCents: true, menuItem: { select: { name: true } } } },
      },
    });

    // Daily series over every day in range (zeros included), Athens calendar.
    const daily = new Map<string, { orders: number; netCents: number }>();
    for (let d = from; d <= to; d = addDays(d, 1)) daily.set(d, { orders: 0, netCents: 0 });
    const dishes = new Map<string, { name: string; quantity: number; revenueCents: number }>();
    for (const o of orders) {
      const day = daily.get(businessDateKey(o.createdAt));
      if (day) {
        day.orders += 1;
        day.netCents += netSalesCents(o);
      }
      for (const i of o.items) {
        const d = dishes.get(i.menuItemId) ?? { name: i.menuItem.name, quantity: 0, revenueCents: 0 };
        d.quantity += i.quantity;
        d.revenueCents += i.quantity * i.unitPriceCents;
        dishes.set(i.menuItemId, d);
      }
    }
    const series = [...daily.entries()].map(([date, v]) => ({ date, ...v }));

    const weekdays = WEEKDAYS.map((label, wd) => {
      const ds = series.filter((s) => weekdayOf(s.date) === wd);
      return { weekday: label, avgOrders: ds.length ? Math.round((ds.reduce((s, x) => s + x.orders, 0) / ds.length) * 10) / 10 : 0 };
    });

    // Customers: active, returning (2+ orders in range), new (first order ever in range).
    const perUser = new Map<string, number>();
    for (const o of orders) perUser.set(o.userId, (perUser.get(o.userId) ?? 0) + 1);
    const firsts = perUser.size
      ? await this.prisma.order.groupBy({ by: ["userId"], where: { userId: { in: [...perUser.keys()] }, status: { not: "cancelled" } }, _min: { createdAt: true } })
      : [];
    const rangeStart = startOfBusinessDate(from).getTime();
    const newCustomers = firsts.filter((f) => (f._min?.createdAt?.getTime() ?? 0) >= rangeStart).length;

    const netTotal = orders.reduce((s, o) => s + netSalesCents(o), 0);
    const nameOf = new Map([...dishes.entries()].map(([id, d]) => [id, d.name]));
    const combos = basketPairs(orders.map((o) => o.items.map((i) => i.menuItemId))).map((p) => ({
      ...p, aName: nameOf.get(p.a) ?? p.a, bName: nameOf.get(p.b) ?? p.b,
    }));

    return {
      from, to, days,
      totals: {
        orders: orders.length,
        netSalesCents: netTotal,
        averageOrderCents: orders.length ? Math.round(netTotal / orders.length) : 0,
      },
      series,
      weekdays,
      topDishes: [...dishes.values()].sort((a, b) => b.revenueCents - a.revenueCents).slice(0, 8),
      customers: {
        active: perUser.size,
        returning: [...perUser.values()].filter((n) => n >= 2).length,
        new: newCustomers,
      },
      channels: {
        viaGym: orders.filter((o) => o.gymId).length,
        employerSubsidised: orders.filter((o) => o.companyPaidCents > 0).length,
        mealPlan: orders.filter((o) => o.subscriptionCoveredCents > 0).length,
        loyaltyReward: orders.filter((o) => o.loyaltyDiscountCents > 0).length,
      },
      combos,
      forecastAccuracy: await this.accuracy(addDays(to, -28), to),
    };
  }

  /** Stored forecasts vs what sold, on days the shop was open (last 4 weeks). */
  private async accuracy(fromKey: string, toKey: string) {
    const forecasts = await this.prisma.demandForecast.findMany({
      where: { businessDate: { gte: fromKey, lt: toKey }, predicted: { not: null } },
      select: { menuItemId: true, businessDate: true, predicted: true },
    });
    if (forecasts.length === 0) return null;
    const sales = await this.prisma.$queryRaw<{ menuItemId: string; day: string; portions: number }[]>`
      SELECT oi."menuItemId" AS "menuItemId",
             to_char((o."createdAt" AT TIME ZONE 'UTC') AT TIME ZONE ${BUSINESS_TIME_ZONE}, 'YYYY-MM-DD') AS "day",
             SUM(oi."quantity")::int AS "portions"
      FROM "order_items" oi JOIN "orders" o ON o."id" = oi."orderId"
      WHERE o."status" <> 'cancelled'
        AND o."createdAt" >= ${startOfBusinessDate(fromKey)} AND o."createdAt" < ${startOfBusinessDate(toKey)}
      GROUP BY 1, 2`;
    const openDays = new Set(sales.map((s) => s.day));
    const sold = new Map(sales.map((s) => [`${s.menuItemId}|${s.day}`, Number(s.portions)]));
    return forecastAccuracy(
      forecasts
        .filter((f) => openDays.has(f.businessDate))
        .map((f) => ({ predicted: f.predicted as number, actual: sold.get(`${f.menuItemId}|${f.businessDate}`) ?? 0 })),
    );
  }
}
