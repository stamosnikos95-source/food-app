import { NotFoundException } from "@nestjs/common";
import { AdminInventoryService } from "./admin-inventory.service";
import { AdminPlanningService } from "./admin-planning.service";

const admin = { id: "admin-1", email: "owner@example.com", role: "admin" } as never;
const audit = () => ({ record: jest.fn() });
const chicken = { id: "i-chk", name: "Κοτόπουλο", costPerKgCents: 850, kcalPer100g: 165, proteinPer100g: 31, carbsPer100g: 0, fatPer100g: 3.6, allergens: [] };
const quinoa = { id: "i-qn", name: "Κινόα", costPerKgCents: 600, kcalPer100g: 368, proteinPer100g: 14, carbsPer100g: 64, fatPer100g: 6, allergens: [] };
const recipe = { menuItemId: "bowl", yieldPortions: 10, lines: [
  { ingredientId: "i-chk", grams: 1500, ingredient: chicken },
  { ingredientId: "i-qn", grams: 800, ingredient: quinoa },
] };

describe("AdminInventoryService", () => {
  it("derives stock from the ledger and flags low, negative and soon-expiring items", async () => {
    const prisma = {
      ingredient: { findMany: jest.fn().mockResolvedValue([
        { ...chicken, reorderLevelG: 2000, isActive: true },
        { ...quinoa, reorderLevelG: null, isActive: true },
        { id: "i-feta", name: "Φέτα", costPerKgCents: 900, reorderLevelG: null, isActive: true },
      ]) },
      stockMovement: {
        groupBy: jest.fn().mockResolvedValue([
          { ingredientId: "i-chk", _sum: { quantityG: 1500 }, _max: { createdAt: new Date() } },
          { ingredientId: "i-qn", _sum: { quantityG: -200 }, _max: { createdAt: new Date() } },
        ]),
        findMany: jest.fn().mockResolvedValue([{ ingredientId: "i-chk", expiresOn: "2026-09-28" }, { ingredientId: "i-feta", expiresOn: "2026-09-28" }]),
      },
    };
    const service = new AdminInventoryService(prisma as never, audit() as never);
    const { items, totals } = await service.overview(new Date("2026-09-27T09:00:00Z"));
    const byId = Object.fromEntries(items.map((i) => [i.id, i]));
    expect(byId["i-chk"]).toMatchObject({ stockG: 1500, low: true, valueCents: 1275, expiringOn: "2026-09-28", needsCount: false });
    expect(byId["i-qn"]).toMatchObject({ stockG: -200, needsCount: true, valueCents: 0 });
    expect(byId["i-feta"].expiringOn).toBeNull(); // nothing in stock, so nothing to expire
    expect(totals).toEqual({ valueCents: 1275, low: 1, expiring: 1 });
  });

  it("records a stock count as the difference from the ledger", async () => {
    const prisma = {
      ingredient: { findUnique: jest.fn().mockResolvedValue({ id: "i-chk" }) },
      stockMovement: { aggregate: jest.fn().mockResolvedValue({ _sum: { quantityG: 1800 } }), create: jest.fn() },
    };
    const service = new AdminInventoryService(prisma as never, audit() as never);
    expect(await service.count({ ingredientId: "i-chk", countedG: 1500 }, admin)).toEqual({ countedG: 1500, previousG: 1800, adjustedByG: -300 });
    expect(prisma.stockMovement.create.mock.calls[0][0].data).toMatchObject({ type: "adjustment", quantityG: -300 });
    prisma.stockMovement.create.mockClear();
    await service.count({ ingredientId: "i-chk", countedG: 1800 }, admin);
    expect(prisma.stockMovement.create).not.toHaveBeenCalled();
  });

  it("updates the ingredient's cost to the latest purchase price, atomically", async () => {
    const tx = { stockMovement: { create: jest.fn().mockResolvedValue({ id: "mv1" }) }, ingredient: { update: jest.fn() } };
    const prisma = { ingredient: { findUnique: jest.fn().mockResolvedValue({ id: "i-chk" }) }, $transaction: jest.fn((fn) => fn(tx)) };
    const service = new AdminInventoryService(prisma as never, audit() as never);
    await service.purchase({ ingredientId: "i-chk", quantityG: 5000, costPerKgCents: 920, expiresOn: "2026-10-01" }, admin);
    expect(tx.stockMovement.create.mock.calls[0][0].data).toMatchObject({ type: "purchase", quantityG: 5000, expiresOn: "2026-10-01" });
    expect(tx.ingredient.update).toHaveBeenCalledWith({ where: { id: "i-chk" }, data: { costPerKgCents: 920 } });
  });

  it("404s for unknown ingredients", async () => {
    const prisma = { ingredient: { findUnique: jest.fn().mockResolvedValue(null) } };
    const service = new AdminInventoryService(prisma as never, audit() as never);
    await expect(service.waste({ ingredientId: "x", quantityG: 10, reason: "spoiled" }, admin)).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe("AdminPlanningService", () => {
  const planningPrisma = () => ({
    menuItem: { findMany: jest.fn().mockResolvedValue([
      { id: "bowl", name: "Bowl", createdAt: new Date("2026-08-01T08:00:00Z") },
      { id: "wrap", name: "Wrap", createdAt: new Date("2026-08-01T08:00:00Z") },
    ]) },
    // Four steady Tuesdays for the bowl; the wrap was on the menu but never sold.
    $queryRaw: jest.fn().mockResolvedValue(
      ["2026-09-29", "2026-09-22", "2026-09-15", "2026-09-08"].map((day) => ({ menuItemId: "bowl", day, portions: 20 })),
    ),
    productionRun: { groupBy: jest.fn().mockResolvedValue([]) },
    dishWaste: { groupBy: jest.fn().mockResolvedValue([]) },
    recipe: { findMany: jest.fn().mockResolvedValue([recipe]) },
    stockMovement: { groupBy: jest.fn().mockResolvedValue([{ ingredientId: "i-chk", _sum: { quantityG: 1000 } }]) },
    demandForecast: { upsert: jest.fn((args) => args) },
    $transaction: jest.fn((ops) => Promise.all(ops)),
  });

  it("forecasts each dish and turns the plan into ingredient needs vs stock", async () => {
    const prisma = planningPrisma();
    const service = new AdminPlanningService(prisma as never, audit() as never);
    const plan = await service.plan("2026-10-06", new Date("2026-10-05T10:00:00Z"));

    expect(plan.weekday).toBe("Τρίτη");
    expect(plan.dishes.find((d) => d.menuItem.id === "bowl")).toMatchObject({ predicted: 20, recommended: 20, confidence: "high" });
    expect(plan.dishes.find((d) => d.menuItem.id === "wrap")).toMatchObject({ recommended: 0 });
    // 20 portions of a 10-portion recipe: 3 kg chicken (1 kg in stock), 1.6 kg quinoa (none)
    expect(plan.ingredients).toEqual([
      { ingredientId: "i-chk", name: "Κοτόπουλο", requiredG: 3000, stockG: 1000, shortfallG: 2000 },
      { ingredientId: "i-qn", name: "Κινόα", requiredG: 1600, stockG: 0, shortfallG: 1600 },
    ]);
    expect(prisma.demandForecast.upsert).toHaveBeenCalledTimes(2); // kept to measure accuracy later
  });

  it("does not overwrite forecasts for days already past", async () => {
    const prisma = planningPrisma();
    await new AdminPlanningService(prisma as never, audit() as never).plan("2026-10-06", new Date("2026-10-10T10:00:00Z"));
    expect(prisma.demandForecast.upsert).not.toHaveBeenCalled();
  });

  it("deducts recipe ingredients pro rata when production is recorded, with a cost snapshot", async () => {
    const tx = { productionRun: { create: jest.fn().mockResolvedValue({ id: "run1" }) }, stockMovement: { createMany: jest.fn() } };
    const prisma = {
      menuItem: { findUnique: jest.fn().mockResolvedValue({ id: "bowl", recipe }) },
      $transaction: jest.fn((fn) => fn(tx)),
    };
    const service = new AdminPlanningService(prisma as never, audit() as never);
    const run = await service.recordProduction({ menuItemId: "bowl", portions: 20, date: "2026-10-06" }, admin);

    expect(run.deductedStock).toBe(true);
    // (1.5 kg x 8.50 + 0.8 kg x 6.00) / 10 portions = 1.755 -> 176 cents
    expect(tx.productionRun.create.mock.calls[0][0].data).toMatchObject({ portions: 20, businessDate: "2026-10-06", costPerPortionCents: 176 });
    expect(tx.stockMovement.createMany.mock.calls[0][0].data).toEqual([
      expect.objectContaining({ ingredientId: "i-chk", type: "production", quantityG: -3000, productionRunId: "run1" }),
      expect.objectContaining({ ingredientId: "i-qn", type: "production", quantityG: -1600, productionRunId: "run1" }),
    ]);

    tx.stockMovement.createMany.mockClear();
    await service.recordProduction({ menuItemId: "bowl", portions: 5, deductStock: false }, admin);
    expect(tx.stockMovement.createMany).not.toHaveBeenCalled();
  });

  it("reports waste in portions and euros, with the share of production", async () => {
    const prisma = {
      dishWaste: { findMany: jest.fn().mockResolvedValue([
        { menuItemId: "bowl", portions: 3, costPerPortionCents: 176, menuItem: { name: "Bowl" } },
        { menuItemId: "bowl", portions: 1, costPerPortionCents: 176, menuItem: { name: "Bowl" } },
      ]) },
      stockMovement: { findMany: jest.fn().mockResolvedValue([
        { ingredientId: "i-chk", quantityG: -500, ingredient: { name: "Κοτόπουλο", costPerKgCents: 850 } },
      ]) },
      productionRun: { aggregate: jest.fn().mockResolvedValue({ _sum: { portions: 80 } }) },
    };
    const report = await new AdminPlanningService(prisma as never, audit() as never).wasteReport(7, new Date("2026-10-06T10:00:00Z"));
    expect(report.dishes).toEqual([{ name: "Bowl", portions: 4, costCents: 704 }]);
    expect(report.ingredients).toEqual([{ name: "Κοτόπουλο", grams: 500, costCents: 425 }]);
    expect(report.totals).toEqual({ dishCostCents: 704, ingredientCostCents: 425, wastedPortions: 4, producedPortions: 80, wastePercent: 5 });
    expect(report.from).toBe("2026-09-30");
  });
});
