import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { AuthUser } from "@food-app/shared-types";
import { PrismaService } from "../../../prisma/prisma.service";
import { AuditService } from "../../audit/audit.service";
import { ASSIGNABLE_ROLES, ListCustomersQuery } from "./people.dto";

const PAGE_SIZE = 25;

// Deliberately no profile data (body metrics, allergies): the back office
// doesn't need health data to run orders, so it never leaves the customer's
// own account (GDPR data minimisation).
const customerSelect = {
  id: true,
  email: true,
  role: true,
  createdAt: true,
  companyMembership: { select: { company: { select: { id: true, name: true } } } },
} satisfies Prisma.UserSelect;

type CustomerRow = Prisma.UserGetPayload<{ select: typeof customerSelect }>;

@Injectable()
export class AdminCustomersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(query: ListCustomersQuery) {
    const page = query.page ?? 1;
    const search = query.search?.trim();
    const where: Prisma.UserWhereInput = search ? { email: { contains: search, mode: "insensitive" } } : {};
    const [total, users] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where, select: customerSelect, orderBy: { createdAt: "desc" }, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE,
      }),
    ]);
    const stats = await this.statsFor(users.map((u) => u.id));
    return { total, page, pageSize: PAGE_SIZE, customers: users.map((u) => this.toView(u, stats)) };
  }

  async detail(id: string, actor: AuthUser) {
    const user = await this.prisma.user.findUnique({ where: { id }, select: customerSelect });
    if (!user) throw new NotFoundException("Customer not found");
    const [stats, recentOrders] = await Promise.all([
      this.statsFor([id]),
      this.prisma.order.findMany({
        where: { userId: id },
        orderBy: { createdAt: "desc" },
        take: 10,
        select: {
          id: true, status: true, totalPriceCents: true, companyPaidCents: true, createdAt: true,
          items: { select: { quantity: true, menuItem: { select: { name: true } } } },
        },
      }),
    ]);
    await this.audit.record(actor.id, "customer.viewed", "user", id);
    return { ...this.toView(user, stats), recentOrders };
  }

  async setRole(id: string, role: (typeof ASSIGNABLE_ROLES)[number], actor: AuthUser) {
    if (id === actor.id && role !== "admin") {
      throw new BadRequestException("You can't remove your own admin role");
    }
    const target = await this.prisma.user.findUnique({ where: { id }, select: { id: true, role: true } });
    if (!target) throw new NotFoundException("Customer not found");
    if (target.role === role) return this.detail(id, actor);

    if (target.role === "admin") {
      const admins = await this.prisma.user.count({ where: { role: "admin" } });
      if (admins <= 1) throw new ConflictException("At least one admin must remain");
    }
    await this.prisma.user.update({ where: { id }, data: { role } });
    await this.audit.record(actor.id, "customer.role_changed", "user", id, { from: target.role, to: role });
    return this.detail(id, actor);
  }

  private toView(user: CustomerRow, stats: Map<string, CustomerStats>) {
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
      company: user.companyMembership?.company ?? null,
      ...(stats.get(user.id) ?? { orders: 0, spentCents: 0, lastOrderAt: null }),
    };
  }

  private async statsFor(ids: string[]): Promise<Map<string, CustomerStats>> {
    if (ids.length === 0) return new Map();
    const rows = await this.prisma.order.groupBy({
      by: ["userId"],
      where: { userId: { in: ids }, status: { not: "cancelled" } },
      _count: { _all: true },
      _sum: { totalPriceCents: true },
      _max: { createdAt: true },
    });
    return new Map(
      rows.map((r) => [
        r.userId,
        { orders: r._count?._all ?? 0, spentCents: r._sum?.totalPriceCents ?? 0, lastOrderAt: r._max?.createdAt ?? null },
      ]),
    );
  }
}

interface CustomerStats {
  orders: number;
  spentCents: number;
  lastOrderAt: Date | null;
}
