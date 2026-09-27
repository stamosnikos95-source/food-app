import { Controller, Get, Req, UseGuards } from "@nestjs/common";
import { Request } from "express";
import { AuthUser } from "@food-app/shared-types";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RecommendationsService } from "./recommendations.service";

@UseGuards(JwtAuthGuard)
@Controller("recommendations")
export class RecommendationsController {
  constructor(private readonly recommendations: RecommendationsService) {}

  /** Today's menu ranked for the signed-in customer, with reasons. */
  @Get("today")
  today(@Req() request: Request & { user: AuthUser }) {
    return this.recommendations.today(request.user.id);
  }
}
