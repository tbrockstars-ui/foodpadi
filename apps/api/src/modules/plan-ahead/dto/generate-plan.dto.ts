import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

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

  // Free-text steer for the whole plan ("Nigerian food this week", "quick
  // family dinners", "no rice") — passed to Claude as `focus`, the same
  // free-text field the single-day "replace with something specific" flow
  // already uses. Optional: omitted, generation falls back to the user's
  // stored cuisine/avoided-ingredient preferences alone, same as before.
  @IsOptional()
  @IsString()
  @MaxLength(200)
  prompt?: string;
}
