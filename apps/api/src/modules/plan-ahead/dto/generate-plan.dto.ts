import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';

export type PlanScope = 'today' | 'tomorrow' | '3day' | 'week' | 'custom';

export class GeneratePlanDto {
  @IsIn(['today', 'tomorrow', '3day', 'week', 'custom'])
  scope!: PlanScope;

  // Required only when scope === 'custom'; validated in the service rather
  // than here since it's conditional on another field.
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(14)
  customDays?: number;

  @IsOptional()
  @IsInt()
  @Min(100)
  budgetPence?: number;
}
