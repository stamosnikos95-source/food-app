import { Type } from "class-transformer";
import { ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsIn, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min, ValidateNested } from "class-validator";

export class OrderItemInput {
  @IsString()
  @MaxLength(64)
  menuItemId!: string;

  @IsInt()
  @Min(1)
  @Max(50) // bounded: prices x quantities must fit the total's integer column
  quantity!: number;
}

export class CreateOrderDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(30)
  @ValidateNested({ each: true })
  @Type(() => OrderItemInput)
  items!: OrderItemInput[];

  /** Portions to pay with meal-plan credits (M8). */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(30)
  subscriptionMeals?: number;

  /** Spend one loyalty reward on this order (M8). */
  @IsOptional()
  @IsBoolean()
  redeemPoints?: boolean;

  /** Partner gym QR code the customer arrived with (M9). */
  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9]{6,32}$/)
  gymCode?: string;

  /** "gym" = delivered to the partner gym; needs a gym code with delivery. */
  @IsOptional()
  @IsIn(["store", "gym"])
  fulfillment?: "store" | "gym";
}
