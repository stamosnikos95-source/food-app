import { ConflictException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { OrderStatus, Prisma } from "@prisma/client";
import { AuthUser, ORDER_STATUS_TRANSITIONS } from "@food-app/shared-types";
import { PrismaService } from "../../prisma/prisma.service";
import { PaymentsService } from "../payments/payments.service";
import { AuditService } from "../audit/audit.service";
import { LoyaltyService } from "../loyalty/loyalty.service";
import { SubscriptionsService } from "../subscriptions/subscriptions.service";
import { ListAdminOrdersQuery } from "./dto/admin-orders.dto";

const ACTIVE: OrderStatus[] = ["pending", "confirmed", "ready"];

const boardInclude = {
  items: { include: { menuItem: { select: { name: true, allergens: true } } } },
  user: { select: { email: true } },
  gym: { select: { name: true } },
  payments: { where: { status: "succeeded" as const }, select: { id: true } },
} satisfies Prisma.OrderInclude;

type BoardOrder = Prisma.OrderGetPayload<{ include: typeof boardInclude }>;

function toBoardView({ user, payments, ...order }: BoardOrder) {
  return { ...order, customerEmail: user.email, paidOnline: payments.length > 0 };
}

@Injectable()
export class AdminOrdersService {
  private readonly logger = new Logger(AdminOrdersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly payments: PaymentsService,
    private readonly audit: AuditService,
    private readonly loyalty: LoyaltyService,
    private readonly subscriptions: SubscriptionsService,
  ) {}

  async list(query: ListAdminOrdersQuery) {
    const where: Prisma.OrderWhereInput = {};
    if (query.status === "active") where.status = { in: ACTIVE };
    else if (query.status) where.status = query.status;
    if (query.from || query.to) {
      where.createdAt = {
        ...(query.from ? { gte: new Date(query.from) } : {}),
        ...(query.to ? { lt: new Date(query.to) } : {}),
      };
    }

    const orders = await this.prisma.order.findMany({
      where,
      include: boardInclude,
      orderBy: { createdAt: "asc" }, // kitchen works oldest first
      take: 200,
    });
    return orders.map(toBoardView);
  }

  async updateStatus(orderId: string, next: OrderStatus, actor: AuthUser) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException("Order not found");

    if (!ORDER_STATUS_TRANSITIONS[order.status].includes(next)) {
      throw new ConflictException(`An order can't move from "${order.status}" to "${next}"`);
    }

    if (next === "cancelled") {
      // Close any checkout still open so a cancelled order can't be paid
      // afterwards, and refuse if the customer has already paid.
      const { paid } = await this.payments.settleBeforeCancel(orderId);
      if (paid) {
        throw new ConflictException(
          "This order was paid online; it needs a refund before it can be cancelled",
        );
      }
    }

    // Optimistic concurrency: two staff tapping at once can't both apply a
    // move. Side effects share the transaction, so they happen exactly once.
    await this.prisma.$transaction(async (tx) => {
      const result = await tx.order.updateMany({
        where: { id: orderId, status: order.status },
        data: { status: next },
      });
      if (result.count !== 1) {
        throw new ConflictException("The order changed in the meantime; refresh and try again");
      }
      if (next === "completed") await this.loyalty.awardForCompletedOrder(tx, order);
      if (next === "cancelled") {
        await this.loyalty.reverseRedemption(tx, order);
        await this.subscriptions.releaseMeals(tx, order);
      }
    });

    await this.audit.record(actor.id, "order.status_changed", "order", orderId, {
      from: order.status,
      to: next,
    });
    this.logger.log(`Order ${orderId}: ${order.status} -> ${next}`);

    const updated = await this.prisma.order.findUniqueOrThrow({
      where: { id: orderId },
      include: boardInclude,
    });
    return toBoardView(updated);
  }
}
