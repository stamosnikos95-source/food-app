import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { CompanyAllowanceService } from "../companies/company-allowance.service";
import { LoyaltyService } from "../loyalty/loyalty.service";
import { SubscriptionsService } from "../subscriptions/subscriptions.service";
import { GymsService } from "../gyms/gyms.service";
import { CreateOrderDto } from "./dto/create-order.dto";

interface OrderableMenuItem {
  id: string;
  priceCents: number;
  isActive: boolean;
}

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly allowance: CompanyAllowanceService,
    private readonly subscriptions: SubscriptionsService,
    private readonly loyalty: LoyaltyService,
    private readonly gyms: GymsService,
  ) {}

  async create(userId: string, dto: CreateOrderDto) {
    const menuItemIds = dto.items.map((i) => i.menuItemId);
    const menuItems: OrderableMenuItem[] = await this.prisma.menuItem.findMany({
      where: { id: { in: menuItemIds } },
    });

    const menuItemById = new Map<string, OrderableMenuItem>(
      menuItems.map((item): [string, OrderableMenuItem] => [item.id, item]),
    );

    for (const line of dto.items) {
      const item = menuItemById.get(line.menuItemId);
      if (!item || !item.isActive) {
        throw new BadRequestException(
          `Menu item ${line.menuItemId} is not available`,
        );
      }
    }

    // Price is always taken from the current menu, never from the client —
    // otherwise a modified request could set its own price.
    const orderItemsData = dto.items.map((line) => {
      const item = menuItemById.get(line.menuItemId)!;
      return {
        menuItemId: item.id,
        quantity: line.quantity,
        unitPriceCents: item.priceCents,
      };
    });

    const totalPriceCents = orderItemsData.reduce(
      (sum, line) => sum + line.unitPriceCents * line.quantity,
      0,
    );

    // One transaction, fixed order of discounts: meal-plan credits, then the
    // employer subsidy on what's left, then the partner-gym member discount,
    // then a loyalty reward. Each claim row-locks what it spends, so
    // concurrent orders can't double-spend credits, allowance or points.
    const fulfillment = dto.fulfillment ?? "store";
    return this.prisma.$transaction(async (tx) => {
      const gym = dto.gymCode ? await this.gyms.resolveForOrder(tx, dto.gymCode, fulfillment) : null;
      if (!gym && fulfillment === "gym") throw new BadRequestException("Delivery to a gym needs a gym code");
      const plan = dto.subscriptionMeals
        ? await this.subscriptions.claimMeals(tx, userId, dto.subscriptionMeals, orderItemsData)
        : { subscriptionId: null, meals: 0, cents: 0 };
      const afterPlan = totalPriceCents - plan.cents;
      const subsidy = await this.allowance.claimForOrder(tx, userId, afterPlan);
      const afterSubsidy = afterPlan - subsidy.cents;
      const gymDiscountCents = gym ? Math.floor((afterSubsidy * gym.discountPercent) / 100) : 0;
      const afterGym = afterSubsidy - gymDiscountCents;
      const reward = dto.redeemPoints
        ? await this.loyalty.prepareRedemption(tx, userId, afterGym)
        : { points: 0, cents: 0 };

      const order = await tx.order.create({
        data: {
          userId,
          totalPriceCents,
          subscriptionId: plan.subscriptionId,
          subscriptionMeals: plan.meals,
          subscriptionCoveredCents: plan.cents,
          companyId: subsidy.companyId,
          companyPaidCents: subsidy.cents,
          loyaltyPointsRedeemed: reward.points,
          loyaltyDiscountCents: reward.cents,
          gymId: gym?.gymId ?? null,
          gymQrCodeId: gym?.qrCodeId ?? null,
          gymDiscountCents,
          fulfillment,
          items: { create: orderItemsData },
        },
        include: { items: { include: { menuItem: true } } },
      });
      if (reward.points > 0) await this.loyalty.recordRedemption(tx, userId, order.id, reward.points);
      return order;
    });
  }

  async listForUser(userId: string) {
    return this.prisma.order.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      include: { items: { include: { menuItem: true } } },
    });
  }

  async findOne(userId: string, orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { items: { include: { menuItem: true } } },
    });

    if (!order) {
      throw new NotFoundException("Order not found");
    }
    if (order.userId !== userId) {
      // Reads as "not found" territory for the caller, but kept explicit
      // (ForbiddenException) so the distinction shows up in logs/tests.
      throw new ForbiddenException("You don't have access to this order");
    }

    return order;
  }
}
