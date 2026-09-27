import { BadRequestException, ConflictException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Prisma } from "@prisma/client";
import { AdminKitchenService } from "./admin-kitchen.service";
import { PrismaService } from "../../../prisma/prisma.service";
import { AuditService } from "../../audit/audit.service";

const actor = { id: "admin-1", email: "owner@example.com", role: "admin" } as never;
const yogurt = { id: "i-yog", name: "Γιαούρτι", kcalPer100g: 59, proteinPer100g: 10, carbsPer100g: 3.6, fatPer100g: 0.4, costPerKgCents: 400, allergens: ["milk"] };

function setup() {
  const prisma = {
    ingredient: { findMany: jest.fn(), findUnique: jest.fn(), create: jest.fn(), update: jest.fn(), count: jest.fn() },
    recipe: { findUnique: jest.fn(), create: jest.fn() },
    menuItem: { update: jest.fn((args) => Promise.resolve({ id: args.where.id, ...args.data })) },
  };
  const audit = { record: jest.fn() };
  const config = { get: jest.fn(() => 13) } as unknown as ConfigService;
  const service = new AdminKitchenService(prisma as unknown as PrismaService, audit as unknown as AuditService, config);
  return { prisma, audit, service };
}

describe("AdminKitchenService", () => {
  it("rejects ingredients whose macros exceed 100 g per 100 g", async () => {
    const { service, prisma } = setup();
    await expect(
      service.createIngredient({ name: "Λάθος", costPerKgCents: 100, kcalPer100g: 400, proteinPer100g: 60, carbsPer100g: 30, fatPer100g: 20 }, actor),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.ingredient.create).not.toHaveBeenCalled();
  });

  it("maps a duplicate ingredient name to 409", async () => {
    const { service, prisma } = setup();
    prisma.ingredient.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("dup", { code: "P2002", clientVersion: "5" }),
    );
    await expect(
      service.createIngredient({ name: "Φέτα", costPerKgCents: 900, kcalPer100g: 264, proteinPer100g: 14, carbsPer100g: 4, fatPer100g: 21 }, actor),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it("rejects a recipe listing the same ingredient twice, or an unknown one", async () => {
    const { service, prisma } = setup();
    const line = { ingredientId: "11111111-1111-4111-8111-111111111111", grams: 10 };
    await expect(service.createRecipe({ name: "Δοκιμή", yieldPortions: 1, lines: [line, line] }, actor)).rejects.toBeInstanceOf(BadRequestException);
    prisma.ingredient.count.mockResolvedValue(0);
    await expect(service.createRecipe({ name: "Δοκιμή", yieldPortions: 1, lines: [line] }, actor)).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.recipe.create).not.toHaveBeenCalled();
  });

  it("applies per-portion nutrition to the dish and MERGES allergens", async () => {
    const { service, prisma, audit } = setup();
    prisma.recipe.findUnique.mockResolvedValue({
      id: "r1", name: "Bowl", yieldPortions: 2, notes: null,
      menuItem: { id: "m1", name: "Bowl", priceCents: 850, allergens: ["sesame"] },
      lines: [{ ingredientId: yogurt.id, grams: 400, ingredient: yogurt }],
    });

    const updated = await service.applyToMenu("r1", actor);

    expect(prisma.menuItem.update).toHaveBeenCalledWith({
      where: { id: "m1" },
      data: { calories: 118, proteinG: 20, carbsG: 7.2, fatG: 0.8, portionWeightG: 200, allergens: ["milk", "sesame"] },
    });
    expect(updated.allergens).toEqual(["milk", "sesame"]); // hand-declared sesame is kept
    expect(audit.record).toHaveBeenCalledWith("admin-1", "menu.nutrition_from_recipe", "menu_item", "m1", expect.anything());
  });

  it("refuses to apply a recipe that isn't linked to a dish", async () => {
    const { service, prisma } = setup();
    prisma.recipe.findUnique.mockResolvedValue({ id: "r1", name: "x", yieldPortions: 1, notes: null, menuItem: null, lines: [] });
    await expect(service.applyToMenu("r1", actor)).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.menuItem.update).not.toHaveBeenCalled();
  });

  it("reports food cost % against the net price of the linked dish", async () => {
    const { service, prisma } = setup();
    prisma.recipe.findUnique.mockResolvedValue({
      id: "r1", name: "Bowl", yieldPortions: 1, notes: null,
      menuItem: { id: "m1", name: "Bowl", priceCents: 850, allergens: [] },
      lines: [{ ingredientId: yogurt.id, grams: 490, ingredient: yogurt }], // 196 cents
    });
    const view = await service.getRecipe("r1");
    expect(view.costing.perPortion.costCents).toBe(196);
    expect(view.foodCostPercent).toBe(26.1);
    expect(view.lines[0]).toEqual({ ingredientId: "i-yog", name: "Γιαούρτι", grams: 490, costCents: 196 });
  });
});
