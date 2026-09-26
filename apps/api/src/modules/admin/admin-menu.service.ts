import { Injectable, NotFoundException } from "@nestjs/common";
import { MenuItem, Prisma } from "@prisma/client";
import { AuthUser } from "@food-app/shared-types";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { CreateMenuItemDto, UpdateMenuItemDto } from "./dto/menu-item.dto";

@Injectable()
export class AdminMenuService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  list() {
    return this.prisma.menuItem.findMany({ orderBy: [{ isActive: "desc" }, { name: "asc" }] });
  }

  async create(dto: CreateMenuItemDto, actor: AuthUser) {
    const item = await this.prisma.menuItem.create({ data: dto });
    await this.audit.record(actor.id, "menu_item.created", "menu_item", item.id, {
      name: item.name,
      priceCents: item.priceCents,
    });
    return item;
  }

  /**
   * Dishes are never hard-deleted (past orders reference them); retiring a
   * dish is `isActive: false`. Price edits don't touch existing orders,
   * which store their own unit price.
   */
  async update(id: string, dto: UpdateMenuItemDto, actor: AuthUser) {
    const existing = await this.prisma.menuItem.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Menu item not found");

    const item = await this.prisma.menuItem.update({ where: { id }, data: dto });

    const changes: Record<string, { from: unknown; to: unknown }> = {};
    for (const key of Object.keys(dto) as (keyof UpdateMenuItemDto & keyof MenuItem)[]) {
      if (JSON.stringify(existing[key]) !== JSON.stringify(dto[key])) {
        changes[key] = { from: existing[key], to: dto[key] };
      }
    }
    if (Object.keys(changes).length > 0) {
      await this.audit.record(
        actor.id,
        "menu_item.updated",
        "menu_item",
        id,
        changes as Prisma.InputJsonValue,
      );
    }
    return item;
  }
}
