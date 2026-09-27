import { ConflictException, Injectable, NotFoundException, UnauthorizedException } from "@nestjs/common";
import * as argon2 from "argon2";
import { randomBytes } from "crypto";
import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../../prisma/prisma.service";
import { UpdateProfileDto } from "./dto/update-profile.dto";

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

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
        excludedAllergens: [] as string[],
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

  /** GDPR right of access: everything held about the customer, as JSON. */
  async exportData(userId: string) {
    const [user, profile, orders, loyalty, subscriptions, membership] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: userId }, select: { email: true, role: true, createdAt: true } }),
      this.prisma.customerProfile.findUnique({ where: { userId } }),
      this.prisma.order.findMany({
        where: { userId },
        orderBy: { createdAt: "asc" },
        select: {
          id: true, createdAt: true, status: true, fulfillment: true, totalPriceCents: true, companyPaidCents: true,
          subscriptionCoveredCents: true, gymDiscountCents: true, loyaltyDiscountCents: true,
          items: { select: { quantity: true, unitPriceCents: true, menuItem: { select: { name: true } } } },
        },
      }),
      this.prisma.loyaltyEntry.findMany({ where: { userId }, orderBy: { createdAt: "asc" }, select: { type: true, points: true, createdAt: true } }),
      this.prisma.subscription.findMany({ where: { userId }, select: { status: true, createdAt: true, currentPeriodEnd: true, plan: { select: { name: true } } } }),
      this.prisma.companyMember.findUnique({ where: { userId }, select: { company: { select: { name: true } } } }),
    ]);
    if (!user) throw new NotFoundException("User not found");
    await this.audit.record(userId, "user.data_exported", "user", userId);
    return {
      exportedAt: new Date().toISOString(),
      account: user,
      profile,
      company: membership?.company.name ?? null,
      orders: orders.map(({ items, ...o }) => ({
        ...o,
        items: items.map((i) => ({ dish: i.menuItem.name, quantity: i.quantity, unitPriceCents: i.unitPriceCents })),
      })),
      loyalty,
      subscriptions: subscriptions.map((s) => ({ plan: s.plan.name, status: s.status, createdAt: s.createdAt, currentPeriodEnd: s.currentPeriodEnd })),
    };
  }

  /**
   * GDPR right to erasure. Orders are accounting records and must be kept,
   * so the account is anonymised instead of deleted: personal data (email,
   * profile, employer link, sessions) goes; orders stay, tied to no one.
   */
  async deleteAccount(userId: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException("User not found");
    if (!(await argon2.verify(user.passwordHash, password))) throw new UnauthorizedException("Wrong password");
    const open = await this.prisma.order.count({ where: { userId, status: { in: ["pending", "confirmed", "ready"] } } });
    if (open > 0) throw new ConflictException("You have an order in progress");

    // A real (random, discarded) password hash: login simply fails, never errors.
    const unusableHash = await argon2.hash(randomBytes(32).toString("hex"));
    await this.prisma.$transaction([
      this.prisma.subscription.updateMany({ where: { userId, status: { in: ["pending", "active"] } }, data: { status: "cancelled" } }),
      this.prisma.customerProfile.deleteMany({ where: { userId } }),
      this.prisma.companyMember.deleteMany({ where: { userId } }),
      this.prisma.refreshToken.deleteMany({ where: { userId } }),
      this.prisma.user.update({
        where: { id: userId },
        data: { email: `deleted-${userId}@deleted.invalid`, passwordHash: unusableHash, role: "customer" },
      }),
    ]);
    await this.audit.record(userId, "user.deleted_self", "user", userId);
  }
}
