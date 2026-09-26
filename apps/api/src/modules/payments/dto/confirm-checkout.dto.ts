import { Matches } from "class-validator";

export class ConfirmCheckoutDto {
  @Matches(/^cs_(test|live)_[A-Za-z0-9]{10,255}$/)
  sessionId!: string;
}
