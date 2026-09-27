import { Controller, Get, Req, UseGuards } from "@nestjs/common";
import { Request } from "express";
import { AuthUser } from "@food-app/shared-types";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CompanyAllowanceService } from "./company-allowance.service";

@UseGuards(JwtAuthGuard)
@Controller("companies")
export class CompaniesController {
  constructor(private readonly allowance: CompanyAllowanceService) {}

  /** The signed-in customer's employer subsidy for today, if any. */
  @Get("mine")
  async mine(@Req() request: Request & { user: AuthUser }) {
    return { allowance: await this.allowance.statusFor(request.user.id) };
  }
}
