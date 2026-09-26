import { NotFoundException } from "@nestjs/common";
import { AuthUser, Role } from "@food-app/shared-types";
import { AdminMenuService } from "./admin-menu.service";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";

const admin: AuthUser = { id: "a1", email: "owner@example.com", role: Role.ADMIN };
const dish = { id: "m1", name: "Bowl", priceCents: 850, allergens: ["milk"], isActive: true };

describe("AdminMenuService", () => {
  let prisma: { menuItem: { findUnique: jest.Mock; update: jest.Mock; create: jest.Mock; findMany: jest.Mock } };
  let audit: { record: jest.Mock };
  let service: AdminMenuService;

  beforeEach(() => {
    prisma = { menuItem: { findUnique: jest.fn(), update: jest.fn(), create: jest.fn(), findMany: jest.fn() } };
    audit = { record: jest.fn() };
    service = new AdminMenuService(prisma as unknown as PrismaService, audit as unknown as AuditService);
  });

  it("audits only the fields that actually changed", async () => {
    prisma.menuItem.findUnique.mockResolvedValue(dish);
    prisma.menuItem.update.mockResolvedValue({ ...dish, priceCents: 900 });

    await service.update("m1", { priceCents: 900, name: "Bowl", allergens: ["milk"] }, admin);

    expect(audit.record).toHaveBeenCalledWith("a1", "menu_item.updated", "menu_item", "m1",
      { priceCents: { from: 850, to: 900 } });
  });

  it("doesn't write an audit entry for a no-op save", async () => {
    prisma.menuItem.findUnique.mockResolvedValue(dish);
    prisma.menuItem.update.mockResolvedValue(dish);
    await service.update("m1", { name: "Bowl" }, admin);
    expect(audit.record).not.toHaveBeenCalled();
  });

  it("404s for unknown dishes", async () => {
    prisma.menuItem.findUnique.mockResolvedValue(null);
    await expect(service.update("x", { name: "Y" }, admin)).rejects.toBeInstanceOf(NotFoundException);
  });

  it("creates dishes and audits the creation", async () => {
    prisma.menuItem.create.mockResolvedValue({ ...dish, id: "m2" });
    await service.create({ name: "Bowl", priceCents: 850, portionWeightG: 400, calories: 540,
      proteinG: 42, carbsG: 48, fatG: 18, allergens: ["milk"] }, admin);
    expect(audit.record).toHaveBeenCalledWith("a1", "menu_item.created", "menu_item", "m2", expect.any(Object));
  });
});
