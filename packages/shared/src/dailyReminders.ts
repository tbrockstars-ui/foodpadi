// FoodPadi Daily Companion Reminders — a friendly "it's around your usual
// lunch/coffee time" nudge, entirely separate from Plan Ahead's per-meal
// reminders (planTiming.ts) and Cooking Journey timers (cookingJourney.ts).
// Same spirit as those two files: deterministic, no I/O, `now`/`date`
// injectable for tests — the API/DB is the source of truth for what the user
// configured, these functions only interpret it (which schedule applies
// today, whether a slot should fire, what a notification should say).

export const DAILY_REMINDER_MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'coffee'] as const;
export type DailyReminderMealType = (typeof DAILY_REMINDER_MEAL_TYPES)[number];

export interface DailyReminderSlotView {
  enabled: boolean;
  /** "HH:mm" 24h, local time — never a UTC offset (see the file header: the
   * device's own clock is always what fires these, so DST/travel need no
   * special handling). Null until the user sets a time for this slot. */
  time: string | null;
}

export type DailyReminderDaySchedule = Record<DailyReminderMealType, DailyReminderSlotView>;

export interface DailyReminderPreferencesView {
  /** Global pause switch — off suspends every slot below without clearing
   * any of them (turning it back on restores exactly what was configured). */
  enabled: boolean;
  weekday: DailyReminderDaySchedule;
  weekend: DailyReminderDaySchedule;
  updatedAt: string | null;
}

export interface UpdateDailyReminderSlotRequest {
  enabled?: boolean;
  /** "HH:mm" 24h, or null to clear the configured time. Omit to leave the
   * current time unchanged. */
  time?: string | null;
}

export interface UpdateDailyReminderPreferencesRequest {
  /** The global pause switch — see DailyReminderPreferencesView.enabled. */
  enabled?: boolean;
  weekday?: Partial<Record<DailyReminderMealType, UpdateDailyReminderSlotRequest>>;
  weekend?: Partial<Record<DailyReminderMealType, UpdateDailyReminderSlotRequest>>;
}

/** Suggested starting points shown in onboarding/settings, clearly labelled
 * as suggestions in the UI — never saved until the user actually acts on
 * them (brief §37: "the user must be able to modify them", never assumed as
 * their actual routine). */
export const SUGGESTED_DAILY_REMINDER_TIMES: Record<'weekday' | 'weekend', Record<DailyReminderMealType, string>> = {
  weekday: { breakfast: '08:00', lunch: '13:00', dinner: '19:00', coffee: '10:30' },
  weekend: { breakfast: '09:00', lunch: '14:00', dinner: '19:30', coffee: '11:00' },
};

/** Monday-Friday → 'weekday', Saturday/Sunday → 'weekend' — evaluated
 * against whatever Date the caller passes, which should always be `new
 * Date()` (the device's local clock) so this naturally follows the user's
 * current local day with no timezone bookkeeping of its own (brief §5/§21). */
export function dayKindFor(date: Date): 'weekday' | 'weekend' {
  const day = date.getDay(); // 0 = Sunday, 6 = Saturday
  return day === 0 || day === 6 ? 'weekend' : 'weekday';
}

/** The schedule that actually applies right now, given the local day. */
export function scheduleForDate(prefs: DailyReminderPreferencesView, date: Date): DailyReminderDaySchedule {
  return prefs[dayKindFor(date)];
}

const REMINDER_COPY: Record<DailyReminderMealType, { emoji: string; title: string; body: string }> = {
  breakfast: { emoji: '🍳', title: 'Breakfast time?', body: "It's around your usual breakfast time." },
  lunch: { emoji: '🍽️', title: 'Lunch time?', body: "It's around your usual lunch time." },
  dinner: { emoji: '🍲', title: 'Dinner time?', body: 'Ready to decide what to eat?' },
  coffee: { emoji: '☕', title: 'Coffee time?', body: 'Your usual coffee break is now.' },
};

export interface DailyReminderNotificationContent {
  title: string;
  body: string;
  /** Where the notification's action should take the user (brief §27/§28). */
  deepLink: string;
  actionLabel: string;
}

/**
 * The generic (no Plan/Cooking context) notification for one slot — brief
 * §26/§4/§13. Coffee never mentions food; breakfast/lunch/dinner always
 * offer "What should I eat?" rather than naming a dish (brief §8 — FoodPadi
 * never decides FOR the user).
 */
export function genericReminderContent(mealType: DailyReminderMealType): DailyReminderNotificationContent {
  const copy = REMINDER_COPY[mealType];
  return {
    title: `${copy.emoji} ${copy.title}`,
    body: copy.body,
    deepLink: '/cook-today',
    actionLabel: mealType === 'coffee' ? 'Open FoodPadi' : 'What should I eat?',
  };
}

/** A specific planned meal at this slot beats the generic nudge (brief §11). */
export function planReminderContent(mealType: DailyReminderMealType, recipeTitle: string): DailyReminderNotificationContent {
  const copy = REMINDER_COPY[mealType];
  return {
    title: `${copy.emoji} ${copy.title}`,
    body: `${recipeTitle} is on your plan.`,
    deepLink: '/plan',
    actionLabel: 'View Plan',
  };
}

/** An active Cooking Journey beats the generic nudge too (brief §12). */
export function cookingReminderContent(recipeTitle: string): DailyReminderNotificationContent {
  return {
    title: '🍳 Still cooking?',
    body: `You still have ${recipeTitle} to finish.`,
    deepLink: '/cook-today',
    actionLabel: 'Continue Cooking',
  };
}

/** Context available at schedule/fire time, used only to avoid duplicating
 * an existing, more specific reminder (brief §10/§11/§12/§45) — this never
 * changes what Plan/Cooking already do, it only decides whether the GENERIC
 * companion reminder for one slot should also fire. */
export interface DailyReminderDedupContext {
  /** A Plan Ahead item exists for today in this exact meal slot with a
   * resolved effective time (planTiming.ts) — its own reminder mechanism
   * already covers this slot with the real recipe name. Never true for
   * 'coffee' (Plan Ahead has no coffee slot). */
  planCoversSlotToday: boolean;
  /** The user has an active Cooking Journey right now — they're already
   * mid-recipe, so a generic "is it dinner time" ping is redundant
   * regardless of which slot it nominally matches. */
  hasActiveCookingJourney: boolean;
}

/** True when the generic reminder for this slot should be suppressed because
 * something more specific already covers it. Coffee is never suppressed by
 * an active Cooking Journey alone (finishing dinner doesn't make a coffee
 * reminder redundant) — only a Plan item literally in the coffee slot would,
 * which Plan Ahead doesn't have, so coffee is effectively never suppressed. */
export function shouldSuppressGenericReminder(
  mealType: DailyReminderMealType,
  context: DailyReminderDedupContext,
): boolean {
  if (context.planCoversSlotToday) return true;
  if (mealType === 'coffee') return false;
  return context.hasActiveCookingJourney;
}
