import { Injectable, NotFoundException } from "@nestjs/common";
import { AuthUser } from "@food-app/shared-types";
import { PrismaService } from "../../../prisma/prisma.service";
import { AuditService } from "../../audit/audit.service";
import { addDays, businessDateKey } from "../../companies/business-time";
import { IngredientWasteDto, PurchaseDto, StockCountDto } from "./operations.dto";

const EXPIRY_WARNING_DAYS = 2;
const round1 = (x: number) => Math.round(x * 10) / 10;

@Injectable()
export class AdminInventoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** Stock per ingredient (sum of its ledger), value, low-stock and expiry flags. */
  async overview(now = new Date()) {
    const today = businessDateKey(now);
    const [ingredients, sums, expiring] = await Promise.all([
      this.prisma.ingredient.findMany({ orderBy: { name: "asc" } }),
      this.prisma.stockMovement.groupBy({ by: ["ingredientId"], _sum: { quantityG: true }, _max: { createdAt: true } }),
      this.prisma.stockMovement.findMany({
        where: { type: "purchase", expiresOn: { gte: today, lte: addDays(today, EXPIRY_WARNING_DAYS) } },
        orderBy: { expiresOn: "asc" },
        select: { ingredientId: true, expiresOn: true },
      }),
    ]);
    const ledger = new Map(sums.map((s) => [s.ingredientId, { grams: s._sum?.quantityG ?? 0, last: s._max?.createdAt ?? null }]));

    const items = ingredients.map((i) => {
      const grams = ledger.get(i.id)?.grams ?? 0;
      const expiringOn = grams > 0 ? expiring.find((e) => e.ingredientId === i.id)?.expiresOn ?? null : null;
      return {
        id: i.id,
        name: i.name,
        isActive: i.isActive,
        stockG: round1(grams),
        reorderLevelG: i.reorderLevelG,
        costPerKgCents: i.costPerKgCents,
        valueCents: Math.round((Math.max(0, grams) / 1000) * i.costPerKgCents),
        low: i.reorderLevelG != null && grams <= i.reorderLevelG,
        // Below zero means production used more than was ever recorded in: needs a count.
        needsCount: grams < 0,
        expiringOn,
        lastMovementAt: ledger.get(i.id)?.last ?? null,
      };
    });
    return {
      items,
      totals: {
        valueCents: items.reduce((s, i) => s + i.valueCents, 0),
        low: items.filter((i) => i.low).length,
        expiring: items.filter((i) => i.expiringOn).length,
      },
    };
  }

  async purchase(dto: PurchaseDto, actor: AuthUser) {
    await this.ensureIngredient(dto.ingredientId);
    const movement = await this.prisma.$transaction(async (tx) => {
      const created = await tx.stockMovement.create({
        data: {
          ingredientId: dto.ingredientId, type: "purchase", quantityG: dto.quantityG,
          costPerKgCents: dto.costPerKgCents ?? null, expiresOn: dto.expiresOn ?? null, note: dto.note, actorId: actor.id,
        },
      });
      // The latest purchase price becomes the ingredient's cost, so recipe
      // costing and food cost % follow real supplier prices.
      if (dto.costPerKgCents != null) {
        await tx.ingredient.update({ where: { id: dto.ingredientId }, data: { costPerKgCents: dto.costPerKgCents } });
      }
      return created;
    });
    await this.audit.record(actor.id, "inventory.purchase", "ingredient", dto.ingredientId, { quantityG: dto.quantityG, costPerKgCents: dto.costPerKgCents });
    return movement;
  }

  async waste(dto: IngredientWasteDto, actor: AuthUser) {
    await this.ensureIngredient(dto.ingredientId);
    const movement = await this.prisma.stockMovement.create({
      data: { ingredientId: dto.ingredientId, type: "waste", quantityG: -dto.quantityG, reason: dto.reason, note: dto.note, actorId: actor.id },
    });
    await this.audit.record(actor.id, "inventory.waste", "ingredient", dto.ingredientId, { quantityG: dto.quantityG, reason: dto.reason });
    return movement;
  }

  /** Physical count: records the difference as an adjustment. */
  async count(dto: StockCountDto, actor: AuthUser) {
    await this.ensureIngredient(dto.ingredientId);
    const agg = await this.prisma.stockMovement.aggregate({ where: { ingredientId: dto.ingredientId }, _sum: { quantityG: true } });
    const previousG = agg._sum.quantityG ?? 0;
    const adjustedByG = round1(dto.countedG - previousG);
    if (adjustedByG !== 0) {
      await this.prisma.stockMovement.create({
        data: { ingredientId: dto.ingredientId, type: "adjustment", quantityG: adjustedByG, note: dto.note, actorId: actor.id },
      });
    }
    await this.audit.record(actor.id, "inventory.count", "ingredient", dto.ingredientId, { countedG: dto.countedG, previousG: round1(previousG) });
    return { countedG: dto.countedG, previousG: round1(previousG), adjustedByG };
  }

  async movements(ingredientId: string) {
    await this.ensureIngredient(ingredientId);
    return this.prisma.stockMovement.findMany({ where: { ingredientId }, orderBy: { createdAt: "desc" }, take: 50 });
  }

  private async ensureIngredient(id: string) {
    const found = await this.prisma.ingredient.findUnique({ where: { id }, select: { id: true } });
    if (!found) throw new NotFoundException("Ingredient not found");
  }
}
