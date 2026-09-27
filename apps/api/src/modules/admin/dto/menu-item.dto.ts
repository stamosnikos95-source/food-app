import { PartialType } from "@nestjs/mapped-types";
import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Max,
  MaxLength,
  Min,
} from "class-validator";
import { ALLERGEN_CODES, DIET_TAG_CODES } from "@food-app/shared-types";

export class CreateMenuItemDto {
  @IsString()
  @Length(2, 80)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  category?: string;

  @IsInt()
  @Min(0)
  @Max(100_000)
  priceCents!: number;

  @IsInt()
  @Min(1)
  @Max(5_000)
  portionWeightG!: number;

  @IsInt()
  @Min(0)
  @Max(5_000)
  calories!: number;

  @IsNumber({ maxDecimalPlaces: 1 })
  @Min(0)
  @Max(500)
  proteinG!: number;

  @IsNumber({ maxDecimalPlaces: 1 })
  @Min(0)
  @Max(500)
  carbsG!: number;

  @IsNumber({ maxDecimalPlaces: 1 })
  @Min(0)
  @Max(500)
  fatG!: number;

  @IsArray()
  @ArrayUnique()
  @IsIn(ALLERGEN_CODES as string[], { each: true })
  allergens!: string[];

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsIn(DIET_TAG_CODES as string[], { each: true })
  dietTags?: string[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateMenuItemDto extends PartialType(CreateMenuItemDto) {}
