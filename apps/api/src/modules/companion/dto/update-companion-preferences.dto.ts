import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateCompanionPreferencesDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsBoolean()
  notificationsEnabled?: boolean;
}
