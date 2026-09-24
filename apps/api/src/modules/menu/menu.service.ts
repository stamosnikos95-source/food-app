import { Injectable, Logger, NotFoundException, OnModuleInit } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { SAMPLE_MENU_ITEMS } from "./sample-menu-items";

@Injectable()
export class MenuService implements OnModuleInit {
  private readonly logger = new Logger(MenuService.name);

  constructor(private readonly prisma: PrismaService) {}

  // No admin UI exists yet to create menu items (that's M5), so on first
  // boot against an empty table we seed a starter menu. Safe to run on
  // every restart: it's a no-op once items exist.
  async onModuleInit() {
    const count = await this.prisma.menuItem.count();
    if (count > 0) return;

    for (const item of SAMPLE_MENU_ITEMS) {
      await this.prisma.menuItem.upsert({
        where: { id: item.id },
        update: {},
        create: item,
      });
    }
    this.logger.log(`Seeded ${SAMPLE_MENU_ITEMS.length} starter menu items`);
  }

  async listActive() {
    return this.prisma.menuItem.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
    });
  }

  async findOne(id: string) {
    const item = await this.prisma.menuItem.findUnique({ where: { id } });
    if (!item) {
      throw new NotFoundException("Menu item not found");
    }
    return item;
  }
}
