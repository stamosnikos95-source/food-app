import { IsEmail, IsString, MinLength } from "class-validator";

export class RegisterDto {
  @IsEmail()
  email!: string;

  // Kept intentionally simple for M0; strengthen (breach list, entropy check)
  // before this reaches production.
  @IsString()
  @MinLength(8)
  password!: string;
}
