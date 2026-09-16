import { Type } from 'class-transformer';
import { IsBoolean, IsOptional, Matches, ValidateNested } from 'class-validator';

// "HH:mm" 24h, local time — same convention as MealPlan.defaultMealTime /
// MealPlanItem.plannedTime. Deliberately no timezone/offset on the wire; see
// packages/shared/src/dailyReminders.ts's file header for why.
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

// `@IsOptional()` skips validation for BOTH `undefined` (field omitted —
// "leave this alone") and `null` ("clear the time") — exactly the two
// non-string cases this needs to accept without hitting @Matches, so no
// extra `@ValidateIf` is needed here.
class DailyReminderSlotDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @Matches(TIME_PATTERN, { message: 'time must be "HH:mm" (24h local time)' })
  time?: string | null;
}

class DailyReminderDayDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => DailyReminderSlotDto)
  breakfast?: DailyReminderSlotDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => DailyReminderSlotDto)
  lunch?: DailyReminderSlotDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => DailyReminderSlotDto)
  dinner?: DailyReminderSlotDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => DailyReminderSlotDto)
  coffee?: DailyReminderSlotDto;
}

/**
 * PATCH /users/me/daily-reminders — a partial update: every field at every
 * level is optional, and an omitted slot/field is left exactly as it was
 * (brief §16 — turning one reminder off must never touch the others). Only
 * `enabled: null`-shaped clears are impossible by design (global `enabled`
 * is a plain boolean, brief §17); a slot's `time` can be explicitly cleared
 * with `time: null`.
 */
export class UpdateDailyReminderPreferencesDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @ValidateNested()
  @Type(() => DailyReminderDayDto)
  weekday?: DailyReminderDayDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => DailyReminderDayDto)
  weekend?: DailyReminderDayDto;

  // Distinguishes an onboarding save (fires the one-time
  // `daily_reminders_setup` analytics event) from every later Settings edit.
  // Not persisted anywhere — purely a hint for which event to track.
  @IsOptional()
  source?: 'onboarding' | 'settings';
}
