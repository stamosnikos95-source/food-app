import { NotFoundException } from "@nestjs/common";
import { MenuService } from "./menu.service";
import { PrismaService } from "../../prisma/prisma.service";

describe("MenuService", () => {
  let service: MenuService;
  let prisma: { menuItem: { findMany: jest.Mock; findUnique: jest.Mock } };

  beforeEach(() => {
    prisma = { menuItem: { findMany: jest.fn(), findUnique: jest.fn() } };
    service = new MenuService(prisma as unknown as PrismaService);
  });

  it("lists only active items, ordered by name", async () => {
    prisma.menuItem.findMany.mockResolvedValue([{ id: "1", name: "Bowl" }]);
    const items = await service.listActive();
    expect(prisma.menuItem.findMany).toHaveBeenCalledWith({
      where: { isActive: true },
      orderBy: { name: "asc" },
    });
    expect(items).toHaveLength(1);
  });

  it("returns a single item by id", async () => {
    prisma.menuItem.findUnique.mockResolvedValue({ id: "1", name: "Bowl" });
    const item = await service.findOne("1");
    expect(item.name).toBe("Bowl");
  });

  it("throws NotFoundException for a missing item", async () => {
    prisma.menuItem.findUnique.mockResolvedValue(null);
    await expect(service.findOne("missing")).rejects.toBeInstanceOf(NotFoundException);
  });
});
