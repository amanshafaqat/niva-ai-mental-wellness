import { IsIn, IsOptional } from 'class-validator';

export class UpdateUserPreferencesDto {
  @IsOptional()
  @IsIn(['SHORT', 'BALANCED', 'DETAILED'])
  responseStyle?: 'SHORT' | 'BALANCED' | 'DETAILED';

  @IsOptional()
  @IsIn(['JUST_LISTEN', 'LISTEN_AND_RESPOND', 'HELP_ME_SOLVE'])
  conversationPreference?: 'JUST_LISTEN' | 'LISTEN_AND_RESPOND' | 'HELP_ME_SOLVE';
}
