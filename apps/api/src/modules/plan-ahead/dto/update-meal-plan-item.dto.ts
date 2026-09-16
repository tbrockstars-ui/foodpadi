import { IsIn, IsInt, IsOptional, Matches, Max, Min } from 'class-validator';

export type MealChoice = 'cook' | 'eat_out';

export class UpdateMealPlanItemDto {
  @IsOptional()
  @IsIn(['cook', 'eat_out'])
  mealChoice?: MealChoice;

  // "HH:mm", 24h — e.g. "18:30". Send null to clear a previously-set time —
  // the day then inherits MealPlan.defaultMealTime, if one is set (see
  // packages/shared/src/planTiming.ts's effectivePlannedTime).
  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'plannedTime must be in 24h HH:mm format, e.g. 18:30' })
  plannedTime?: string | null;

  // Per-day override for MealPlan.defaultReminderOffsetMinutes. 0 means "no
  // reminder for this day specifically"; null clears the override so the day
  // goes back to inheriting the plan default.
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(180)
  reminderOffsetMinutes?: number | null;
}
