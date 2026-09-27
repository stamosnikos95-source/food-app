import { Transform } from "class-transformer";
import { IsEmail, IsString } from "class-validator";

export class LoginDto {
  // Emails are case-insensitive in practice: store and compare one form so
  // "Maria@x.com" and "maria@x.com" can never become two accounts.
  @Transform(({ value }) => (typeof value === "string" ? value.trim().toLowerCase() : value))
  @IsEmail()
  email!: string;

  @IsString()
  password!: string;
}
