import { IsNotEmpty, IsString, IsOptional } from 'class-validator';

export class GoogleVerifyTokenDto {
  @IsString()
  @IsNotEmpty()
  idToken: string;

  @IsString()
  @IsOptional()
  accessToken?: string;
}

export class SessionValidationDto {
  @IsString()
  @IsNotEmpty()
  sessionToken: string;
}
