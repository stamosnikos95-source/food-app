import { PartialType } from "@nestjs/mapped-types";
import { Transform, Type } from "class-transformer";
import { IsBoolean, IsEmail, IsIn, IsInt, IsOptional, IsString, Length, Matches, Max, MaxLength, Min } from "class-validator";

const lower = ({ value }: { value: unknown }) => (typeof value === "string" ? value.trim().toLowerCase() : value);

export class ListCustomersQuery {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  page?: number;
}

export const ASSIGNABLE_ROLES = ["customer", "staff", "admin"] as const;
export class SetRoleDto {
  @IsIn(ASSIGNABLE_ROLES)
  role!: (typeof ASSIGNABLE_ROLES)[number];
}

export class CompanyDto {
  @IsString()
  @Length(2, 120)
  name!: string;

  /** Greek ΑΦΜ; checksum verified in the service. */
  @IsString()
  @Matches(/^(EL)?\s*[\d\s]{9,11}$/i)
  vatNumber!: string;

  @Transform(lower)
  @IsEmail()
  billingEmail!: string;

  @IsOptional() @IsString() @MaxLength(120) contactName?: string;
  @IsOptional() @IsString() @MaxLength(40) phone?: string;
  @IsOptional() @IsString() @MaxLength(200) address?: string;

  /** Paid by the company per employee per day, in cents (max €100). */
  @IsInt()
  @Min(0)
  @Max(10_000)
  dailyAllowanceCents!: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateCompanyDto extends PartialType(CompanyDto) {}

export class AddMemberDto {
  @Transform(lower)
  @IsEmail()
  email!: string;
}

export class StatementQuery {
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/)
  month!: string;
}
