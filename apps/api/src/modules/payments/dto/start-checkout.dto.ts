import { IsUUID } from "class-validator";

export class StartCheckoutDto {
  @IsUUID()
  orderId!: string;
}
