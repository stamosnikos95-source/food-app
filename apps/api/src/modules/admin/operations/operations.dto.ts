import { Type } from "class-transformer";
import { IsBoolean, IsIn, IsInt, IsNumber, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min } from "class-validator";

const DATE_KEY = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
export const INGREDIENT_WASTE_REASONS = ["expired", "spoiled", "overproduction", "prep_loss", "other"] as const;
export const DISH_WASTE_REASONS = ["unsold", "quality", "other"] as const;

export class PurchaseDto {
  @IsUUID() ingredientId!: string;
  @IsNumber() @Min(1) @Max(1_000_000) quantityG!: number;
  /** Price paid per kg; also becomes the ingredient's current cost. */
  @IsOptional() @IsInt() @Min(0) @Max(1_000_000) costPerKgCents?: number;
  @IsOptional() @Matches(DATE_KEY) expiresOn?: string;
  @IsOptional() @IsString() @MaxLength(200) note?: string;
}

export class IngredientWasteDto {
  @IsUUID() ingredientId!: string;
  @IsNumber() @Min(1) @Max(1_000_000) quantityG!: number;
  @IsIn(INGREDIENT_WASTE_REASONS) reason!: (typeof INGREDIENT_WASTE_REASONS)[number];
  @IsOptional() @IsString() @MaxLength(200) note?: string;
}

export class StockCountDto {
  @IsUUID() ingredientId!: string;
  @IsNumber() @Min(0) @Max(10_000_000) countedG!: number;
  @IsOptional() @IsString() @MaxLength(200) note?: string;
}

export class PlanningQuery {
  @IsOptional() @Matches(DATE_KEY) date?: string;
}

export class ProductionDto {
  @IsString() @MaxLength(64) menuItemId!: string;
  @IsInt() @Min(1) @Max(2000) portions!: number;
  @IsOptional() @Matches(DATE_KEY) date?: string;
  /** Deduct the recipe's ingredients from stock (default true). */
  @IsOptional() @IsBoolean() deductStock?: boolean;
}

export class LeftoverDto {
  @IsString() @MaxLength(64) menuItemId!: string;
  @IsInt() @Min(1) @Max(2000) portions!: number;
  @IsIn(DISH_WASTE_REASONS) reason!: (typeof DISH_WASTE_REASONS)[number];
  @IsOptional() @Matches(DATE_KEY) date?: string;
}

export class WasteReportQuery {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(92) days?: number;
}
