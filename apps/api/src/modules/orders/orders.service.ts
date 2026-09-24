import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { CreateOrderDto } from "./dto/create-order.dto";

interface OrderableMenuItem {
  id: string;
  priceCents: number;
  isActive: boolean;
}

@Injectable()
export class OrdersService {
  constructor(private readonly prisma: PrismaService) {}

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

    return this.prisma.order.create({
      data: {
        userId,
        totalPriceCents,
        items: { create: orderItemsData },
      },
      include: { items: { include: { menuItem: true } } },
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
