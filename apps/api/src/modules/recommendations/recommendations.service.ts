import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { recommend, RecProfile } from "./recommend";

const RECENT_DAYS = 3;

@Injectable()
export class RecommendationsService {
  constructor(private readonly prisma: PrismaService) {}

  async today(userId: string) {
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
    return recommend(menu, recProfile, new Set(recent.map((r) => r.menuItemId)));
  }
}
