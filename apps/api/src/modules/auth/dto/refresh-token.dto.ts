import { IsString, MaxLength, MinLength } from "class-validator";

export class RefreshTokenDto {
  @IsString()
  @MinLength(32)
  @MaxLength(128)
  refreshToken!: string;
}
