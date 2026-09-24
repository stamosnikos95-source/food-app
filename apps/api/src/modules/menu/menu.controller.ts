import { Controller, Get, Param, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { MenuService } from "./menu.service";

@UseGuards(JwtAuthGuard)
@Controller("menu")
export class MenuController {
  constructor(private readonly menuService: MenuService) {}

  @Get()
  list() {
    return this.menuService.listActive();
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.menuService.findOne(id);
  }
}
