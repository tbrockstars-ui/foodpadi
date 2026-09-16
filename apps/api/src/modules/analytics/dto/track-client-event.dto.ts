import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min, ValidateNested } from 'class-validator';

// The client-only steps of the Cook Today funnel — the ones with no natural
// backend round-trip to piggyback on (generating recipes, scanning, adding
// pantry items, creating a shopping list, marking a recipe cooked and
// submitting feedback already fire their own analytics.track() calls inline
// with the real request; see cook-today.service.ts, scan.service.ts,
// plan-ahead.service.ts and feedback.service.ts). Deliberately an explicit
// allowlist, not free-form event names — this endpoint exists to close one
// specific, small gap, not to become a general client-tracking SDK.
export const CLIENT_EVENT_TYPES = [
  'cook_today_meal_selected',
  'cook_today_start_cooking',
  'cook_today_step_completed',
  'cook_today_shopping_completed',
  // Emitted when the client finds a stale local cook session but the server
  // returned no active journey — the fingerprint of the "lost my progress on
  // logout" bug (docs cooking-journey brief §32). Goal: this stays at zero.
  'cooking_journey_lost',
  // Daily Companion Reminders lifecycle (brief §30/§48) — only the browser
  // knows when a local Notification actually fired/was clicked/was
  // dismissed. Setup/enabled/disabled/time-changed are tracked server-side
  // instead (DailyRemindersService), since those go through a real PATCH.
  'daily_reminder_shown',
  'daily_reminder_opened',
  'daily_reminder_dismissed',
] as const;

export type ClientEventType = (typeof CLIENT_EVENT_TYPES)[number];

// Deliberately a small closed shape, not Record<string, unknown> — an open
// metadata bag on a client-writable endpoint is exactly what §27 (never
// trust client input) and §15 (no unrelated personal data) warn against.
class ClientEventMetadataDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(500)
  stepIndex?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(500)
  totalSteps?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(500)
  itemCount?: number;

  // Which Daily Companion Reminder slot this event is about — validated
  // against the closed set rather than IsIn(DAILY_REMINDER_MEAL_TYPES) to
  // avoid an api→shared→api import for one string literal check.
  @IsOptional()
  @IsIn(['breakfast', 'lunch', 'dinner', 'coffee'])
  mealType?: 'breakfast' | 'lunch' | 'dinner' | 'coffee';
}

export class TrackClientEventDto {
  @IsIn(CLIENT_EVENT_TYPES)
  eventType!: ClientEventType;

  @IsOptional()
  @ValidateNested()
  @Type(() => ClientEventMetadataDto)
  metadata?: ClientEventMetadataDto;
}
