import { IsInt, IsOptional, Matches, Max, Min } from 'class-validator';

/**
 * Sets the plan-wide default eating time and/or reminder lead time —
 * "set once, applies to every day that hasn't been individually overridden"
 * (see packages/shared/src/planTiming.ts). Never touches MealPlanItem rows:
 * an item with no plannedTime/reminderOffsetMinutes of its own simply
 * inherits whatever the plan's current default is, which is what makes
 * changing the default here propagate to non-overridden days for free,
 * without ever clobbering a day the user explicitly customised.
 */
export class UpdatePlanDefaultsDto {
  // "HH:mm", 24h — e.g. "19:00". Send null to clear the plan-wide default
  // (days with no override of their own then have no planned time at all,
  // same as before this feature existed).
  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'defaultMealTime must be in 24h HH:mm format, e.g. 19:00' })
  defaultMealTime?: string | null;

  // Minutes before defaultMealTime a reminder fires for any day that hasn't
  // overridden it. 0 means "no reminder by default". Not nullable — every
  // plan always has a concrete default (30, unless changed), matching the
  // fixed 30-minute behaviour this feature replaces.
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(180)
  defaultReminderOffsetMinutes?: number;
}
