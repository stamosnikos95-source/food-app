import { ConflictException, NotFoundException } from "@nestjs/common";
import { AuthUser, Role } from "@food-app/shared-types";
import { AdminOrdersService } from "./admin-orders.service";
import { PrismaService } from "../../prisma/prisma.service";
import { PaymentsService } from "../payments/payments.service";
import { AuditService } from "../audit/audit.service";

const staff: AuthUser = { id: "staff-1", email: "kitchen@example.com", role: Role.STAFF };
const boardRow = (status: string) => ({
  id: "o1", status, userId: "u1", totalPriceCents: 850, createdAt: new Date(), updatedAt: new Date(),
  items: [], user: { email: "c@example.com" }, payments: [],
});

describe("AdminOrdersService", () => {
  let prisma: { order: { findUnique: jest.Mock; updateMany: jest.Mock; findUniqueOrThrow: jest.Mock; findMany: jest.Mock }; $transaction: jest.Mock };
  let loyalty: { awardForCompletedOrder: jest.Mock; reverseRedemption: jest.Mock };
  let subscriptions: { releaseMeals: jest.Mock };
  let payments: { settleBeforeCancel: jest.Mock };
  let audit: { record: jest.Mock };
  let service: AdminOrdersService;

  beforeEach(() => {
    prisma = { order: { findUnique: jest.fn(), updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      findUniqueOrThrow: jest.fn(), findMany: jest.fn().mockResolvedValue([]) }, $transaction: jest.fn() };
    prisma.$transaction.mockImplementation((fn: (tx: unknown) => unknown) => fn(prisma));
    loyalty = { awardForCompletedOrder: jest.fn(), reverseRedemption: jest.fn() };
    subscriptions = { releaseMeals: jest.fn() };
    payments = { settleBeforeCancel: jest.fn().mockResolvedValue({ paid: false }) };
    audit = { record: jest.fn() };
    service = new AdminOrdersService(prisma as unknown as PrismaService,
      payments as unknown as PaymentsService, audit as unknown as AuditService, loyalty as never, subscriptions as never);
  });

  it("moves an order along the workflow, guarded against concurrent edits, and audits it", async () => {
    prisma.order.findUnique.mockResolvedValue({ id: "o1", status: "pending" });
    prisma.order.findUniqueOrThrow.mockResolvedValue(boardRow("confirmed"));

    const result = await service.updateStatus("o1", "confirmed", staff);

    expect(prisma.order.updateMany).toHaveBeenCalledWith({
      where: { id: "o1", status: "pending" }, data: { status: "confirmed" } });
    expect(audit.record).toHaveBeenCalledWith("staff-1", "order.status_changed", "order", "o1",
      { from: "pending", to: "confirmed" });
    expect(result).toMatchObject({ status: "confirmed", customerEmail: "c@example.com", paidOnline: false });
    expect(payments.settleBeforeCancel).not.toHaveBeenCalled();
  });

  it("rejects moves the workflow doesn't allow", async () => {
    prisma.order.findUnique.mockResolvedValue({ id: "o1", status: "completed" });
    await expect(service.updateStatus("o1", "ready", staff)).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.order.updateMany).not.toHaveBeenCalled();
  });

  it("refuses to cancel an order that was paid online", async () => {
    prisma.order.findUnique.mockResolvedValue({ id: "o1", status: "confirmed" });
    payments.settleBeforeCancel.mockResolvedValue({ paid: true });
    await expect(service.updateStatus("o1", "cancelled", staff)).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.order.updateMany).not.toHaveBeenCalled();
  });

  it("cancels an unpaid order after closing any open checkout", async () => {
    prisma.order.findUnique.mockResolvedValue({ id: "o1", status: "ready" });
    prisma.order.findUniqueOrThrow.mockResolvedValue(boardRow("cancelled"));
    await service.updateStatus("o1", "cancelled", staff);
    expect(payments.settleBeforeCancel).toHaveBeenCalledWith("o1");
    expect(prisma.order.updateMany).toHaveBeenCalled();
  });

  it("reports a conflict when someone else changed the order first", async () => {
    prisma.order.findUnique.mockResolvedValue({ id: "o1", status: "pending" });
    prisma.order.updateMany.mockResolvedValue({ count: 0 });
    await expect(service.updateStatus("o1", "confirmed", staff)).rejects.toBeInstanceOf(ConflictException);
    expect(audit.record).not.toHaveBeenCalled();
  });

  it("404s for unknown orders", async () => {
    prisma.order.findUnique.mockResolvedValue(null);
    await expect(service.updateStatus("nope", "confirmed", staff)).rejects.toBeInstanceOf(NotFoundException);
  });

  it("'active' lists everything the kitchen still has to act on, oldest first", async () => {
    await service.list({ status: "active" });
    expect(prisma.order.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { status: { in: ["pending", "confirmed", "ready"] } }, orderBy: { createdAt: "asc" } }));
  });

  it("awards loyalty points when an order is picked up, inside the same transaction", async () => {
    prisma.order.findUnique.mockResolvedValue({ id: "o1", status: "ready" });
    prisma.order.findUniqueOrThrow.mockResolvedValue(boardRow("completed"));
    await service.updateStatus("o1", "completed", staff);
    expect(loyalty.awardForCompletedOrder).toHaveBeenCalledWith(prisma, { id: "o1", status: "ready" });
    expect(subscriptions.releaseMeals).not.toHaveBeenCalled();
  });

  it("gives back points and meal credits when an order is cancelled", async () => {
    prisma.order.findUnique.mockResolvedValue({ id: "o1", status: "pending" });
    prisma.order.findUniqueOrThrow.mockResolvedValue(boardRow("cancelled"));
    await service.updateStatus("o1", "cancelled", staff);
    expect(loyalty.reverseRedemption).toHaveBeenCalled();
    expect(subscriptions.releaseMeals).toHaveBeenCalled();
    expect(loyalty.awardForCompletedOrder).not.toHaveBeenCalled();
  });
});
