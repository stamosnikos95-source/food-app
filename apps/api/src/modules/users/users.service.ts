import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { UpdateProfileDto } from "./dto/update-profile.dto";

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, email: true, role: true, createdAt: true },
    });

    if (!user) {
      throw new NotFoundException("User not found");
    }

    return user;
  }

  async getProfile(userId: string) {
    const profile = await this.prisma.customerProfile.findUnique({
      where: { userId },
    });

    // No profile yet is a normal state right after registration, not an error.
    return (
      profile ?? {
        userId,
        age: null,
        gender: null,
        heightCm: null,
        weightKg: null,
        activityLevel: null,
        goal: null,
        budgetPerMealCents: null,
        dietaryPreferences: [] as string[],
        excludedIngredients: [] as string[],
      }
    );
  }

  async upsertProfile(userId: string, dto: UpdateProfileDto) {
    return this.prisma.customerProfile.upsert({
      where: { userId },
      create: { userId, ...dto },
      update: { ...dto },
    });
  }
}
