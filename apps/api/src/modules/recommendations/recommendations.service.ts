import { Injectable, Logger } from "@nestjs/common";
import { businessDateKey } from "../companies/business-time";
import { PrismaService } from "../../prisma/prisma.service";
import { recommend, RecProfile } from "./recommend";

const RECENT_DAYS = 3;

@Injectable()
export class RecommendationsService {
  private readonly logger = new Logger(RecommendationsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** `log`: record the picks as shown (off when the assistant reads them internally). */
  async today(userId: string, options: { log?: boolean } = {}) {
    const since = new Date(Date.now() - RECENT_DAYS * 24 * 60 * 60 * 1000);
    const [menu, profile, recent] = await Promise.all([
      this.prisma.menuItem.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
      this.prisma.customerProfile.findUnique({ where: { userId } }),
      this.prisma.orderItem.findMany({
        where: { order: { userId, status: { not: "cancelled" }, createdAt: { gte: since } } },
        select: { menuItemId: true },
      }),
    ]);

    const recProfile: RecProfile = {
      age: profile?.age ?? null,
      gender: profile?.gender ?? null,
      heightCm: profile?.heightCm ?? null,
      weightKg: profile?.weightKg ?? null,
      activityLevel: profile?.activityLevel ?? null,
      goal: profile?.goal ?? null,
      budgetPerMealCents: profile?.budgetPerMealCents ?? null,
      dietaryPreferences: profile?.dietaryPreferences ?? [],
      excludedIngredients: profile?.excludedIngredients ?? [],
      excludedAllergens: profile?.excludedAllergens ?? [],
    };
    const result = recommend(menu, recProfile, new Set(recent.map((r) => r.menuItemId)));
    if (options.log !== false) await this.logShown(userId, result.picks.map((p) => ({ menuItemId: p.item.id, score: p.score })));
    return result;
  }

  /** First impression per customer, dish and day; a logging failure never breaks the answer. */
  private async logShown(userId: string, picks: { menuItemId: string; score: number }[]) {
    if (picks.length === 0) return;
    const businessDate = businessDateKey();
    try {
      await this.prisma.$transaction(
        picks.map((p, i) =>
          this.prisma.recommendationEvent.upsert({
            where: { userId_menuItemId_businessDate: { userId, menuItemId: p.menuItemId, businessDate } },
            create: { userId, menuItemId: p.menuItemId, businessDate, rank: i + 1, score: p.score },
            update: {},
          }),
        ),
      );
    } catch (error) {
      this.logger.warn(`Could not log recommendations: ${(error as Error).message}`);
    }
  }
}
