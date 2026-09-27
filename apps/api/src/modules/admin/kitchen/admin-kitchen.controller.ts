import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Req, UseGuards } from "@nestjs/common";
import { Request } from "express";
import { AuthUser, Role } from "@food-app/shared-types";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../../auth/guards/roles.guard";
import { Roles } from "../../auth/decorators/roles.decorator";
import { AdminKitchenService } from "./admin-kitchen.service";
import {
  CreateIngredientDto,
  CreateRecipeDto,
  UpdateIngredientDto,
  UpdateRecipeDto,
} from "./kitchen.dto";

type AuthedRequest = Request & { user: AuthUser };

/** Costs and supplier prices are business-sensitive: admins only. */
@Controller("admin")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class AdminKitchenController {
  constructor(private readonly kitchen: AdminKitchenService) {}

  @Get("ingredients")
  listIngredients() {
    return this.kitchen.listIngredients();
  }

  @Post("ingredients")
  createIngredient(@Body() dto: CreateIngredientDto, @Req() req: AuthedRequest) {
    return this.kitchen.createIngredient(dto, req.user);
  }

  @Patch("ingredients/:id")
  updateIngredient(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateIngredientDto,
    @Req() req: AuthedRequest,
  ) {
    return this.kitchen.updateIngredient(id, dto, req.user);
  }

  @Get("recipes")
  listRecipes() {
    return this.kitchen.listRecipes();
  }

  @Get("recipes/:id")
  getRecipe(@Param("id", ParseUUIDPipe) id: string) {
    return this.kitchen.getRecipe(id);
  }

  @Post("recipes")
  createRecipe(@Body() dto: CreateRecipeDto, @Req() req: AuthedRequest) {
    return this.kitchen.createRecipe(dto, req.user);
  }

  @Patch("recipes/:id")
  updateRecipe(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateRecipeDto,
    @Req() req: AuthedRequest,
  ) {
    return this.kitchen.updateRecipe(id, dto, req.user);
  }

  @Post("recipes/:id/apply-to-menu")
  applyToMenu(@Param("id", ParseUUIDPipe) id: string, @Req() req: AuthedRequest) {
    return this.kitchen.applyToMenu(id, req.user);
  }
}
