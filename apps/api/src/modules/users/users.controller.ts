import { Body, Controller, Get, Patch, Req, UseGuards } from "@nestjs/common";
import { Request } from "express";
import { AuthUser } from "@food-app/shared-types";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { UsersService } from "./users.service";
import { UpdateProfileDto } from "./dto/update-profile.dto";

@Controller("users")
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @UseGuards(JwtAuthGuard)
  @Get("me")
  me(@Req() request: Request & { user: AuthUser }) {
    return this.usersService.findById(request.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Get("me/profile")
  getProfile(@Req() request: Request & { user: AuthUser }) {
    return this.usersService.getProfile(request.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Patch("me/profile")
  updateProfile(
    @Req() request: Request & { user: AuthUser },
    @Body() dto: UpdateProfileDto,
  ) {
    return this.usersService.upsertProfile(request.user.id, dto);
  }
}
