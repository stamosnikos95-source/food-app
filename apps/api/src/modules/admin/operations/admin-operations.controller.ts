import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, Req, UseGuards } from "@nestjs/common";
import { Request } from "express";
import { AuthUser, Role } from "@food-app/shared-types";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../../auth/guards/roles.guard";
import { Roles } from "../../auth/decorators/roles.decorator";
import { AdminInventoryService } from "./admin-inventory.service";
import { AdminPlanningService } from "./admin-planning.service";
import { IngredientWasteDto, LeftoverDto, PlanningQuery, ProductionDto, PurchaseDto, StockCountDto, WasteReportQuery } from "./operations.dto";

type AuthedRequest = Request & { user: AuthUser };

/** Inventory, production planning and waste (M7). Carries costs: admins only. */
@Controller("admin")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class AdminOperationsController {
  constructor(
    private readonly inventory: AdminInventoryService,
    private readonly planning: AdminPlanningService,
  ) {}

  @Get("inventory")
  overview() {
    return this.inventory.overview();
  }

  @Post("inventory/purchases")
  purchase(@Body() dto: PurchaseDto, @Req() req: AuthedRequest) {
    return this.inventory.purchase(dto, req.user);
  }

  @Post("inventory/waste")
  waste(@Body() dto: IngredientWasteDto, @Req() req: AuthedRequest) {
    return this.inventory.waste(dto, req.user);
  }

  @Post("inventory/count")
  count(@Body() dto: StockCountDto, @Req() req: AuthedRequest) {
    return this.inventory.count(dto, req.user);
  }

  @Get("inventory/:ingredientId/movements")
  movements(@Param("ingredientId", ParseUUIDPipe) ingredientId: string) {
    return this.inventory.movements(ingredientId);
  }

  @Get("planning")
  plan(@Query() query: PlanningQuery) {
    return this.planning.plan(query.date);
  }

  @Post("production")
  recordProduction(@Body() dto: ProductionDto, @Req() req: AuthedRequest) {
    return this.planning.recordProduction(dto, req.user);
  }

  @Post("production/leftovers")
  recordLeftover(@Body() dto: LeftoverDto, @Req() req: AuthedRequest) {
    return this.planning.recordLeftover(dto, req.user);
  }

  @Get("waste")
  wasteReport(@Query() query: WasteReportQuery) {
    return this.planning.wasteReport(query.days ?? 7);
  }
}
