import { BadRequestException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { OrdersService } from "./orders.service";
import { PrismaService } from "../../prisma/prisma.service";

describe("OrdersService", () => {
  let service: OrdersService;
  let prisma: {
    menuItem: { findMany: jest.Mock };
    order: { create: jest.Mock; findMany: jest.Mock; findUnique: jest.Mock };
  };

  beforeEach(() => {
    prisma = {
      menuItem: { findMany: jest.fn() },
      order: { create: jest.fn(), findMany: jest.fn(), findUnique: jest.fn() },
    };
    service = new OrdersService(prisma as unknown as PrismaService);
  });

  describe("create", () => {
    it("prices the order from the current menu, not the request", async () => {
      prisma.menuItem.findMany.mockResolvedValue([
        { id: "m1", priceCents: 850, isActive: true },
        { id: "m2", priceCents: 500, isActive: true },
      ]);
      prisma.order.create.mockResolvedValue({ id: "o1", totalPriceCents: 2200 });

      await service.create("u1", {
        items: [
          { menuItemId: "m1", quantity: 2 },
          { menuItemId: "m2", quantity: 1 },
        ],
      });

      const call = prisma.order.create.mock.calls[0][0];
      expect(call.data.totalPriceCents).toBe(2 * 850 + 1 * 500);
      expect(call.data.items.create).toEqual([
        { menuItemId: "m1", quantity: 2, unitPriceCents: 850 },
        { menuItemId: "m2", quantity: 1, unitPriceCents: 500 },
      ]);
    });

    it("rejects an order containing an inactive or unknown item", async () => {
      prisma.menuItem.findMany.mockResolvedValue([{ id: "m1", priceCents: 850, isActive: false }]);

      await expect(
        service.create("u1", { items: [{ menuItemId: "m1", quantity: 1 }] }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe("findOne", () => {
    it("returns the order when it belongs to the requesting user", async () => {
      prisma.order.findUnique.mockResolvedValue({ id: "o1", userId: "u1" });
      const order = await service.findOne("u1", "o1");
      expect(order.id).toBe("o1");
    });

    it("throws NotFoundException when the order doesn't exist", async () => {
      prisma.order.findUnique.mockResolvedValue(null);
      await expect(service.findOne("u1", "missing")).rejects.toBeInstanceOf(NotFoundException);
    });

    it("throws ForbiddenException when the order belongs to someone else", async () => {
      prisma.order.findUnique.mockResolvedValue({ id: "o1", userId: "someone-else" });
      await expect(service.findOne("u1", "o1")).rejects.toBeInstanceOf(ForbiddenException);
    });
  });
});
