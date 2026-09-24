import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class MenuService {
  constructor(private readonly prisma: PrismaService) {}

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
