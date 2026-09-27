import { PartialType } from "@nestjs/mapped-types";
import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator";
import { ALLERGEN_CODES } from "@food-app/shared-types";

export class CreateIngredientDto {
  @IsString()
  @Length(2, 80)
  name!: string;

  /** Purchase price per kg, in cents (max €10,000/kg). */
  @IsInt()
  @Min(0)
  @Max(1_000_000)
  costPerKgCents!: number;

  @IsNumber()
  @Min(0)
  @Max(900) // pure fat is ~900 kcal/100 g
  kcalPer100g!: number;

  @IsNumber()
  @Min(0)
  @Max(100)
  proteinPer100g!: number;

  @IsNumber()
  @Min(0)
  @Max(100)
  carbsPer100g!: number;

  @IsNumber()
  @Min(0)
  @Max(100)
  fatPer100g!: number;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsIn(ALLERGEN_CODES, { each: true })
  allergens?: string[];

  /** Low-stock alert threshold, grams; null clears it. */
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(10_000_000)
  reorderLevelG?: number | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateIngredientDto extends PartialType(CreateIngredientDto) {}

export class RecipeLineDto {
  @IsUUID()
  ingredientId!: string;

  @IsNumber()
  @Min(0.1)
  @Max(100_000)
  grams!: number;
}

export class CreateRecipeDto {
  @IsString()
  @Length(2, 80)
  name!: string;

  @IsInt()
  @Min(1)
  @Max(500)
  yieldPortions!: number;

  /** Dish this recipe produces; null unlinks it. */
  @IsOptional()
  @IsUUID()
  menuItemId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  @IsArray()
  @ArrayMaxSize(60)
  @ValidateNested({ each: true })
  @Type(() => RecipeLineDto)
  lines!: RecipeLineDto[];
}

export class UpdateRecipeDto extends PartialType(CreateRecipeDto) {}
