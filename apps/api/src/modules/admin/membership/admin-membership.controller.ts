import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import { PartialType } from "@nestjs/mapped-types";
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Length, Max, MaxLength, Min, NotEquals } from "class-validator";
import { Request } from "express";
import { AuthUser, Role } from "@food-app/shared-types";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../../auth/guards/roles.guard";
import { Roles } from "../../auth/decorators/roles.decorator";
import { AuditService } from "../../audit/audit.service";
import { LoyaltyService } from "../../loyalty/loyalty.service";
import { SubscriptionsService } from "../../subscriptions/subscriptions.service";

export class PlanDto {
  @IsString() @Length(2, 80) name!: string;
  @IsOptional() @IsString() @MaxLength(300) description?: string;
  @IsInt() @Min(1) @Max(100) mealsPerPeriod!: number;
  @IsInt() @Min(1) @Max(92) periodDays!: number;
  @IsInt() @Min(0) @Max(1_000_000) priceCents!: number;
  @IsInt() @Min(1) @Max(100_000) maxMealPriceCents!: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
}
export class UpdatePlanDto extends PartialType(PlanDto) {}

export class ListSubscriptionsQuery {
  @IsOptional() @IsIn(["pending", "active", "cancelled"]) status?: "pending" | "active" | "cancelled";
}

export class AdjustPointsDto {
  @IsInt() @Min(-100_000) @Max(100_000) @NotEquals(0) points!: number;
  @IsString() @Length(2, 200) note!: string;
}

type AuthedRequest = Request & { user: AuthUser };

/** Meal plans, subscriptions and loyalty adjustments: admins only. */
@Controller("admin")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class AdminMembershipController {
  constructor(
    private readonly subscriptions: SubscriptionsService,
    private readonly loyalty: LoyaltyService,
    private readonly audit: AuditService,
  ) {}

  @Get("plans")
  plans() {
    return this.subscriptions.listPlans();
  }

  @Post("plans")
  async createPlan(@Body() dto: PlanDto, @Req() req: AuthedRequest) {
    const plan = await this.subscriptions.createPlan({ ...dto, name: dto.name.trim() });
    await this.audit.record(req.user.id, "plan.created", "subscription_plan", plan.id, { ...dto });
    return plan;
  }

  @Patch("plans/:id")
  async updatePlan(@Param("id", ParseUUIDPipe) id: string, @Body() dto: UpdatePlanDto, @Req() req: AuthedRequest) {
    const plan = await this.subscriptions.updatePlan(id, dto);
    await this.audit.record(req.user.id, "plan.updated", "subscription_plan", id, { ...dto });
    return plan;
  }

  @Get("subscriptions")
  list(@Query() query: ListSubscriptionsQuery) {
    return this.subscriptions.list(query.status);
  }

  /** Payment received at the store: start or renew the plan. */
  @Post("subscriptions/:id/activate")
  async activate(@Param("id", ParseUUIDPipe) id: string, @Req() req: AuthedRequest) {
    const result = await this.subscriptions.activate(id);
    await this.audit.record(req.user.id, result.renewal ? "subscription.renewed" : "subscription.activated", "subscription", id);
    return result.subscription;
  }

  @Post("subscriptions/:id/cancel")
  async cancel(@Param("id", ParseUUIDPipe) id: string, @Req() req: AuthedRequest) {
    const sub = await this.subscriptions.cancel(id);
    await this.audit.record(req.user.id, "subscription.cancelled", "subscription", id);
    return sub;
  }

  @Post("customers/:id/points")
  async adjustPoints(@Param("id", ParseUUIDPipe) id: string, @Body() dto: AdjustPointsDto, @Req() req: AuthedRequest) {
    await this.loyalty.adjust(id, dto.points, dto.note.trim(), req.user.id);
    await this.audit.record(req.user.id, "loyalty.adjusted", "user", id, { points: dto.points, note: dto.note });
    return this.loyalty.summary(id);
  }
}
