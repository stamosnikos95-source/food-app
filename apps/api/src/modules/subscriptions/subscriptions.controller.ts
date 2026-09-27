import { Body, Controller, Get, Post, Req, UseGuards } from "@nestjs/common";
import { IsUUID } from "class-validator";
import { Request } from "express";
import { AuthUser } from "@food-app/shared-types";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { SubscriptionsService } from "./subscriptions.service";

class RequestPlanDto {
  @IsUUID()
  planId!: string;
}

type AuthedRequest = Request & { user: AuthUser };

@UseGuards(JwtAuthGuard)
@Controller("subscriptions")
export class SubscriptionsController {
  constructor(private readonly subscriptions: SubscriptionsService) {}

  @Get("plans")
  plans() {
    return this.subscriptions.plans();
  }

  @Get("me")
  mine(@Req() req: AuthedRequest) {
    return this.subscriptions.mine(req.user.id);
  }

  @Post()
  request(@Body() dto: RequestPlanDto, @Req() req: AuthedRequest) {
    return this.subscriptions.request(req.user.id, dto.planId);
  }

  @Post("me/cancel")
  cancel(@Req() req: AuthedRequest) {
    return this.subscriptions.cancelPending(req.user.id);
  }
}
