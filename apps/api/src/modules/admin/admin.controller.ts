import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { Request } from "express";
import { AuthUser, Role } from "@food-app/shared-types";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { AdminOrdersService } from "./admin-orders.service";
import { AdminMenuService } from "./admin-menu.service";
import { AdminReportsService } from "./admin-reports.service";
import { ListAdminOrdersQuery, ReportRangeQuery, UpdateOrderStatusDto } from "./dto/admin-orders.dto";
import { CreateMenuItemDto, UpdateMenuItemDto } from "./dto/menu-item.dto";

type AuthedRequest = Request & { user: AuthUser };

/** Staff run the kitchen board; only admins change the menu. */
@Controller("admin")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.STAFF)
export class AdminController {
  constructor(
    private readonly orders: AdminOrdersService,
    private readonly menu: AdminMenuService,
    private readonly reports: AdminReportsService,
  ) {}

  @Get("orders")
  listOrders(@Query() query: ListAdminOrdersQuery) {
    return this.orders.list(query);
  }

  @Patch("orders/:id/status")
  updateOrderStatus(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateOrderStatusDto,
    @Req() req: AuthedRequest,
  ) {
    return this.orders.updateStatus(id, dto.status, req.user);
  }

  @Get("menu")
  listMenu() {
    return this.menu.list();
  }

  @Post("menu")
  @Roles(Role.ADMIN)
  createMenuItem(@Body() dto: CreateMenuItemDto, @Req() req: AuthedRequest) {
    return this.menu.create(dto, req.user);
  }

  @Patch("menu/:id")
  @Roles(Role.ADMIN)
  updateMenuItem(
    @Param("id") id: string,
    @Body() dto: UpdateMenuItemDto,
    @Req() req: AuthedRequest,
  ) {
    return this.menu.update(id, dto, req.user);
  }

  @Get("reports/summary")
  summary(@Query() query: ReportRangeQuery) {
    return this.reports.summary(query.from, query.to);
  }
}
