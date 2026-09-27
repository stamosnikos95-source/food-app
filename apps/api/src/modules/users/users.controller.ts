import { Body, Controller, Get, Patch, Req, UseGuards, Delete, HttpCode, HttpStatus } from "@nestjs/common";
import { Request } from "express";
import { AuthUser } from "@food-app/shared-types";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { UsersService } from "./users.service";
import { UpdateProfileDto } from "./dto/update-profile.dto";
import { Throttle } from "@nestjs/throttler";
import { IsString, MaxLength, MinLength } from "class-validator";

class DeleteAccountDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  password!: string;
}

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

  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Get("me/export")
  exportData(@Req() request: Request & { user: AuthUser }) {
    return this.usersService.exportData(request.user.id);
  }

  /** Requires the password again: deleting is irreversible. */
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Delete("me")
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteAccount(@Req() request: Request & { user: AuthUser }, @Body() dto: DeleteAccountDto) {
    await this.usersService.deleteAccount(request.user.id, dto.password);
  }
}
