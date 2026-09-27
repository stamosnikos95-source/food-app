import { Transform } from "class-transformer";
import { IsEmail, IsString, MinLength } from "class-validator";

export class RegisterDto {
  // Emails are case-insensitive in practice: store and compare one form so
  // "Maria@x.com" and "maria@x.com" can never become two accounts.
  @Transform(({ value }) => (typeof value === "string" ? value.trim().toLowerCase() : value))
  @IsEmail()
  email!: string;

  // Kept intentionally simple for M0; strengthen (breach list, entropy check)
  // before this reaches production.
  @IsString()
  @MinLength(8)
  password!: string;
}
