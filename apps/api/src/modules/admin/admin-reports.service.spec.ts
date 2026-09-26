import { BadRequestException } from "@nestjs/common";
import { AdminReportsService } from "./admin-reports.service";
import { PrismaService } from "../../prisma/prisma.service";

describe("AdminReportsService", () => {
  const prisma = {
    order: {
      groupBy: jest.fn().mockResolvedValue([{ status: "pending", _count: { _all: 2 } }, { status: "cancelled", _count: { _all: 1 } }]),
      aggregate: jest.fn().mockResolvedValue({ _sum: { totalPriceCents: 2500 }, _count: { _all: 3 } }),
    },
    payment: { aggregate: jest.fn().mockResolvedValue({ _sum: { amountCents: 850 } }) },
    orderItem: { groupBy: jest.fn().mockResolvedValue([{ menuItemId: "m1", _sum: { quantity: 4 } }]) },
    menuItem: { findMany: jest.fn().mockResolvedValue([{ id: "m1", name: "Bowl" }]) },
  };
  const service = new AdminReportsService(prisma as unknown as PrismaService);

  it("summarises sales, excluding cancelled orders from revenue", async () => {
    const r = await service.summary("2026-09-26T00:00:00Z", "2026-09-27T00:00:00Z");
    expect(prisma.order.aggregate).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ status: { not: "cancelled" } }) }));
    expect(r).toMatchObject({ orders: 3, revenueCents: 2500, averageOrderCents: 833, paidOnlineCents: 850,
      byStatus: { pending: 2, cancelled: 1 }, topItems: [{ menuItemId: "m1", name: "Bowl", quantity: 4 }] });
  });

  it("rejects inverted or oversized ranges", async () => {
    await expect(service.summary("2026-09-27T00:00:00Z", "2026-09-26T00:00:00Z")).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.summary("2026-01-01T00:00:00Z", "2026-09-01T00:00:00Z")).rejects.toBeInstanceOf(BadRequestException);
  });
});
