import { Injectable, NotFoundException } from "@nestjs/common";
import { AuthUser } from "@food-app/shared-types";
import { PrismaService } from "../../../prisma/prisma.service";
import { AuditService } from "../../audit/audit.service";
import { addDays, BUSINESS_TIME_ZONE, businessDateKey, startOfBusinessDate, weekdayOf } from "../../companies/business-time";
import { costRecipe } from "../kitchen/recipe-costing";
import { forecastDish, FORECAST_MODEL } from "./forecast";
import { LeftoverDto, ProductionDto } from "./operations.dto";

const HISTORY_DAYS = 56;
const WASTE_WINDOW_DAYS = 14;
const WEEKDAYS = ["Κυριακή", "Δευτέρα", "Τρίτη", "Τετάρτη", "Πέμπτη", "Παρασκευή", "Σάββατο"];
const round1 = (x: number) => Math.round(x * 10) / 10;

interface SalesRow {
  menuItemId: string;
  day: string;
  portions: number;
}

@Injectable()
export class AdminPlanningService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** Production plan for a day (default: tomorrow): forecast per dish + ingredient needs vs stock. */
  async plan(dateKey?: string, now = new Date()) {
    const today = businessDateKey(now);
    const target = dateKey ?? addDays(today, 1);
    const wasteFrom = addDays(target, -WASTE_WINDOW_DAYS);

    const [dishes, sales, produced, leftovers, recipes, stock] = await Promise.all([
      this.prisma.menuItem.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true, createdAt: true } }),
      this.salesByDay(addDays(target, -HISTORY_DAYS), target),
      this.prisma.productionRun.groupBy({ by: ["menuItemId"], where: { businessDate: { gte: wasteFrom, lt: target } }, _sum: { portions: true } }),
      this.prisma.dishWaste.groupBy({ by: ["menuItemId"], where: { reason: "unsold", businessDate: { gte: wasteFrom, lt: target } }, _sum: { portions: true } }),
      this.prisma.recipe.findMany({ where: { menuItemId: { not: null } }, include: { lines: { include: { ingredient: true } } } }),
      this.prisma.stockMovement.groupBy({ by: ["ingredientId"], _sum: { quantityG: true } }),
    ]);

    // A day counts as "open" if anything was sold; on open days a dish that
    // was on the menu but sold nothing is a real 0, not missing data.
    const openDays = [...new Set(sales.map((s) => s.day))];
    const sold = new Map<string, Map<string, number>>();
    for (const s of sales) {
      if (!sold.has(s.menuItemId)) sold.set(s.menuItemId, new Map());
      sold.get(s.menuItemId)!.set(s.day, Number(s.portions));
    }
    const producedBy = new Map(produced.map((p) => [p.menuItemId, p._sum?.portions ?? 0]));
    const leftoverBy = new Map(leftovers.map((l) => [l.menuItemId, l._sum?.portions ?? 0]));
    const recipeBy = new Map(recipes.map((r) => [r.menuItemId as string, r]));

    const forecasts = dishes.map((dish) => {
      const onMenuSince = businessDateKey(dish.createdAt);
      const history: Record<string, number> = {};
      for (const day of openDays) {
        if (day >= onMenuSince && day < target) history[day] = sold.get(dish.id)?.get(day) ?? 0;
      }
      const producedPortions = producedBy.get(dish.id) ?? 0;
      const wasteRatio = producedPortions > 0 ? (leftoverBy.get(dish.id) ?? 0) / producedPortions : 0;
      return { menuItem: { id: dish.id, name: dish.name }, hasRecipe: recipeBy.has(dish.id), ...forecastDish(history, target, wasteRatio) };
    });

    const stockBy = new Map(stock.map((s) => [s.ingredientId, s._sum?.quantityG ?? 0]));
    const needs = new Map<string, { name: string; requiredG: number }>();
    for (const f of forecasts) {
      const recipe = recipeBy.get(f.menuItem.id);
      if (!recipe || !f.recommended) continue;
      for (const line of recipe.lines) {
        const grams = (line.grams / Math.max(1, recipe.yieldPortions)) * f.recommended;
        const entry = needs.get(line.ingredientId) ?? { name: line.ingredient.name, requiredG: 0 };
        entry.requiredG += grams;
        needs.set(line.ingredientId, entry);
      }
    }
    const ingredients = [...needs.entries()]
      .map(([ingredientId, n]) => {
        const stockG = stockBy.get(ingredientId) ?? 0;
        return { ingredientId, name: n.name, requiredG: Math.round(n.requiredG), stockG: Math.round(stockG), shortfallG: Math.max(0, Math.round(n.requiredG - Math.max(0, stockG))) };
      })
      .sort((a, b) => b.shortfallG - a.shortfallG || a.name.localeCompare(b.name, "el"));

    // Keep what we predicted *before* the day, to measure accuracy later.
    if (target >= today) {
      await this.prisma.$transaction(
        forecasts.map((f) =>
          this.prisma.demandForecast.upsert({
            where: { menuItemId_businessDate: { menuItemId: f.menuItem.id, businessDate: target } },
            create: { menuItemId: f.menuItem.id, businessDate: target, predicted: f.predicted, recommended: f.recommended, observations: f.observations, confidence: f.confidence, modelVersion: FORECAST_MODEL },
            update: { predicted: f.predicted, recommended: f.recommended, observations: f.observations, confidence: f.confidence, modelVersion: FORECAST_MODEL },
          }),
        ),
      );
    }

    return { date: target, weekday: WEEKDAYS[weekdayOf(target)], modelVersion: FORECAST_MODEL, openDaysSeen: openDays.length, dishes: forecasts, ingredients };
  }

  /** Records a batch; deducts the recipe's ingredients from stock by default. */
  async recordProduction(dto: ProductionDto, actor: AuthUser, now = new Date()) {
    const businessDate = dto.date ?? businessDateKey(now);
    const dish = await this.loadDish(dto.menuItemId);
    const recipe = dish.recipe && dish.recipe.lines.length > 0 ? dish.recipe : null;
    const costPerPortionCents = recipe ? costRecipe(recipe.lines, recipe.yieldPortions).perPortion.costCents : null;
    const deduct = (dto.deductStock ?? true) && recipe !== null;

    const run = await this.prisma.$transaction(async (tx) => {
      const created = await tx.productionRun.create({
        data: { menuItemId: dish.id, businessDate, portions: dto.portions, costPerPortionCents, actorId: actor.id },
      });
      if (deduct && recipe) {
        await tx.stockMovement.createMany({
          data: recipe.lines.map((line) => ({
            ingredientId: line.ingredientId,
            type: "production" as const,
            quantityG: -round1((line.grams * dto.portions) / Math.max(1, recipe.yieldPortions)),
            productionRunId: created.id,
            actorId: actor.id,
          })),
        });
      }
      return created;
    });
    await this.audit.record(actor.id, "production.recorded", "menu_item", dish.id, { portions: dto.portions, businessDate, deductedStock: deduct });
    return { ...run, deductedStock: deduct };
  }

  /** Prepared portions discarded (e.g. unsold at close). */
  async recordLeftover(dto: LeftoverDto, actor: AuthUser, now = new Date()) {
    const businessDate = dto.date ?? businessDateKey(now);
    const dish = await this.loadDish(dto.menuItemId);
    const recipe = dish.recipe && dish.recipe.lines.length > 0 ? dish.recipe : null;
    const costPerPortionCents = recipe ? costRecipe(recipe.lines, recipe.yieldPortions).perPortion.costCents : null;
    const waste = await this.prisma.dishWaste.create({
      data: { menuItemId: dish.id, businessDate, portions: dto.portions, reason: dto.reason, costPerPortionCents, actorId: actor.id },
    });
    await this.audit.record(actor.id, "production.leftover", "menu_item", dish.id, { portions: dto.portions, reason: dto.reason, businessDate });
    return waste;
  }

  /** Waste in portions and euros over the last N days, dishes and ingredients. */
  async wasteReport(days = 7, now = new Date()) {
    const to = businessDateKey(now);
    const from = addDays(to, -(days - 1));
    const [dishWaste, ingredientWaste, production] = await Promise.all([
      this.prisma.dishWaste.findMany({ where: { businessDate: { gte: from, lte: to } }, include: { menuItem: { select: { name: true } } } }),
      this.prisma.stockMovement.findMany({
        where: { type: "waste", createdAt: { gte: startOfBusinessDate(from), lt: startOfBusinessDate(addDays(to, 1)) } },
        include: { ingredient: { select: { name: true, costPerKgCents: true } } },
      }),
      this.prisma.productionRun.aggregate({ where: { businessDate: { gte: from, lte: to } }, _sum: { portions: true } }),
    ]);

    const dishes = new Map<string, { name: string; portions: number; costCents: number }>();
    for (const w of dishWaste) {
      const d = dishes.get(w.menuItemId) ?? { name: w.menuItem.name, portions: 0, costCents: 0 };
      d.portions += w.portions;
      d.costCents += w.portions * (w.costPerPortionCents ?? 0);
      dishes.set(w.menuItemId, d);
    }
    const ingredients = new Map<string, { name: string; grams: number; costCents: number }>();
    for (const m of ingredientWaste) {
      const grams = -m.quantityG;
      const i = ingredients.get(m.ingredientId) ?? { name: m.ingredient.name, grams: 0, costCents: 0 };
      i.grams += grams;
      i.costCents += Math.round((grams / 1000) * m.ingredient.costPerKgCents);
      ingredients.set(m.ingredientId, i);
    }
    const dishList = [...dishes.values()].sort((a, b) => b.costCents - a.costCents);
    const ingredientList = [...ingredients.values()].map((i) => ({ ...i, grams: Math.round(i.grams) })).sort((a, b) => b.costCents - a.costCents);
    const wastedPortions = dishList.reduce((s, d) => s + d.portions, 0);
    const producedPortions = production._sum.portions ?? 0;
    return {
      from, to, dishes: dishList, ingredients: ingredientList,
      totals: {
        dishCostCents: dishList.reduce((s, d) => s + d.costCents, 0),
        ingredientCostCents: ingredientList.reduce((s, i) => s + i.costCents, 0),
        wastedPortions,
        producedPortions,
        wastePercent: producedPortions > 0 ? round1((wastedPortions / producedPortions) * 100) : null,
      },
    };
  }

  private async loadDish(id: string) {
    const dish = await this.prisma.menuItem.findUnique({
      where: { id },
      include: { recipe: { include: { lines: { include: { ingredient: true } } } } },
    });
    if (!dish) throw new NotFoundException("Dish not found");
    return dish;
  }

  /** Portions sold per dish per Athens calendar day, cancelled orders excluded. */
  private salesByDay(fromKey: string, toKey: string): Promise<SalesRow[]> {
    return this.prisma.$queryRaw<SalesRow[]>`
      SELECT oi."menuItemId" AS "menuItemId",
             to_char((o."createdAt" AT TIME ZONE 'UTC') AT TIME ZONE ${BUSINESS_TIME_ZONE}, 'YYYY-MM-DD') AS "day",
             SUM(oi."quantity")::int AS "portions"
      FROM "order_items" oi
      JOIN "orders" o ON o."id" = oi."orderId"
      WHERE o."status" <> 'cancelled'
        AND o."createdAt" >= ${startOfBusinessDate(fromKey)}
        AND o."createdAt" < ${startOfBusinessDate(toKey)}
      GROUP BY 1, 2`;
  }
}
