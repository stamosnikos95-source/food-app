import { Controller, Get, Req, UseGuards } from "@nestjs/common";
import { Request } from "express";
import { AuthUser } from "@food-app/shared-types";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { LoyaltyService } from "./loyalty.service";

@UseGuards(JwtAuthGuard)
@Controller("loyalty")
export class LoyaltyController {
  constructor(private readonly loyalty: LoyaltyService) {}

  @Get("me")
  me(@Req() request: Request & { user: AuthUser }) {
    return this.loyalty.summary(request.user.id);
  }
}
