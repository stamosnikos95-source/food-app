import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import { PartialType } from "@nestjs/mapped-types";
import { IsBoolean, IsEmail, IsInt, IsOptional, IsString, Length, Matches, Max, MaxLength, Min } from "class-validator";
import { Request } from "express";
import { AuthUser, Role } from "@food-app/shared-types";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../../auth/guards/roles.guard";
import { Roles } from "../../auth/decorators/roles.decorator";
import { AuditService } from "../../audit/audit.service";
import { GymsService } from "../../gyms/gyms.service";

export class GymDto {
  @IsString() @Length(2, 120) name!: string;
  @IsOptional() @IsString() @MaxLength(200) address?: string;
  @IsOptional() @IsString() @MaxLength(120) contactName?: string;
  @IsOptional() @IsString() @MaxLength(40) phone?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsInt() @Min(0) @Max(30) discountPercent!: number;
  @IsInt() @Min(0) @Max(30) commissionPercent!: number;
  @IsOptional() @IsBoolean() deliveryEnabled?: boolean;
  @IsOptional() @IsString() @MaxLength(200) deliveryNote?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
}
export class UpdateGymDto extends PartialType(GymDto) {}
export class NewCodeDto {
  @IsString() @Length(2, 60) label!: string;
}
export class CodeStateDto {
  @IsBoolean() isActive!: boolean;
}
export class MonthQuery {
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/) month!: string;
}

type AuthedRequest = Request & { user: AuthUser };

/** Partner gyms, their QR codes and monthly commission reports: admins only. */
@Controller("admin")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class AdminGymsController {
  constructor(
    private readonly gyms: GymsService,
    private readonly audit: AuditService,
  ) {}

  @Get("gyms")
  list() {
    return this.gyms.list();
  }

  @Post("gyms")
  async create(@Body() dto: GymDto, @Req() req: AuthedRequest) {
    const gym = await this.gyms.create({ ...dto, name: dto.name.trim() });
    await this.audit.record(req.user.id, "gym.created", "gym", gym.id, { name: gym.name });
    return gym;
  }

  @Patch("gyms/:id")
  async update(@Param("id", ParseUUIDPipe) id: string, @Body() dto: UpdateGymDto, @Req() req: AuthedRequest) {
    const gym = await this.gyms.update(id, dto);
    await this.audit.record(req.user.id, "gym.updated", "gym", id, { ...dto });
    return gym;
  }

  @Post("gyms/:id/codes")
  async createCode(@Param("id", ParseUUIDPipe) id: string, @Body() dto: NewCodeDto, @Req() req: AuthedRequest) {
    const code = await this.gyms.createCode(id, dto.label.trim());
    await this.audit.record(req.user.id, "gym.code_created", "gym", id, { codeId: code.id, label: code.label });
    return code;
  }

  @Patch("gym-codes/:codeId")
  async setCode(@Param("codeId", ParseUUIDPipe) codeId: string, @Body() dto: CodeStateDto, @Req() req: AuthedRequest) {
    const code = await this.gyms.setCodeActive(codeId, dto.isActive);
    await this.audit.record(req.user.id, dto.isActive ? "gym.code_enabled" : "gym.code_revoked", "gym", code.gymId, { codeId });
    return code;
  }

  @Get("gyms/:id/report")
  report(@Param("id", ParseUUIDPipe) id: string, @Query() query: MonthQuery) {
    return this.gyms.report(id, query.month);
  }
}
