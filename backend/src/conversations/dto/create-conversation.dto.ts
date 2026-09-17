import { IsString, IsOptional, MaxLength } from 'class-validator';

export class CreateConversationDto {
  @IsString()
  @IsOptional()
  @MaxLength(100)
  title?: string;
}
