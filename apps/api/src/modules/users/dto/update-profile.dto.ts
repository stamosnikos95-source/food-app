import { Type } from "class-transformer";
import {
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from "class-validator";

const ACTIVITY_LEVELS = ["sedentary", "light", "moderate", "active", "very_active"] as const;

export class UpdateProfileDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(13)
  @Max(120)
  age?: number;

  @IsOptional()
  @IsString()
  gender?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(100)
  @Max(250)
  heightCm?: number;

  @IsOptional()
  @Type(() => Number)
  @Min(20)
  @Max(400)
  weightKg?: number;

  @IsOptional()
  @IsIn(ACTIVITY_LEVELS)
  activityLevel?: (typeof ACTIVITY_LEVELS)[number];

  @IsOptional()
  @IsString()
  goal?: string;

  // Stored in cents to avoid floating-point rounding on money values.
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  budgetPerMealCents?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  dietaryPreferences?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  excludedIngredients?: string[];
}
