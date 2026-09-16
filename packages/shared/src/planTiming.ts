// Plan Ahead's "set once, applies to every day, override any day
// individually" timing model — one place both apps (and the API's Companion
// context) compute the *effective* time/reminder for a day, so nobody reads
// `item.plannedTime` directly and accidentally ignores the plan's default.
//
// The model is deliberately simple: an item's own value always wins when
// present; a plan-wide default fills the gap when the item has none. Setting
// or changing the plan default never touches item rows, which is exactly
// what makes it safe to change repeatedly without ever clobbering a day the
// user explicitly customised — a day that was never given its own value
// keeps resolving through whatever the current default is; a day that was
// given its own value keeps resolving through that value regardless of what
// the default later becomes.

export interface PlanTimingItem {
  plannedTime: string | null;
  reminderOffsetMinutes: number | null;
}

export interface PlanTimingDefaults {
  defaultMealTime: string | null;
  defaultReminderOffsetMinutes: number;
}

/** The eating time this day actually uses — its own override, else the
 * plan's default, else null (no time set at all, same as before this
 * feature existed). */
export function effectivePlannedTime(item: PlanTimingItem, plan: PlanTimingDefaults): string | null {
  return item.plannedTime ?? plan.defaultMealTime;
}

/** Minutes before the effective planned time a reminder should fire for this
 * day. 0 means "no reminder" — callers should treat 0 the same as "don't
 * schedule anything", not as a same-minute reminder. */
export function effectiveReminderOffsetMinutes(item: PlanTimingItem, plan: PlanTimingDefaults): number {
  return item.reminderOffsetMinutes ?? plan.defaultReminderOffsetMinutes;
}

// --- Smart start time ---------------------------------------------------
// A distinct, purely informational companion to the reminder above — "start
// around 18:25 to be ready by 19:00" — derived from the recipe's own actual
// time rather than a flat lead time. This NEVER changes when the reminder
// itself fires (that stays exactly effectiveReminderOffsetMinutes, the
// user's explicit choice); it only tells the user, honestly, whether that
// choice leaves enough room for THIS particular recipe.

/** "HH:mm" the user should start cooking to be ready by `eatingTime`, given
 * the recipe's own total time (RecipeView.cookTimeMinutes — already the
 * whole thing, prep included; see recipe-validation.ts's prepTimeMinutes
 * comment). Wraps correctly across midnight for a very early eating time or
 * a very long recipe. */
export function suggestedStartTime(eatingTime: string, recipeCookTimeMinutes: number): string {
  const [hours, minutes] = eatingTime.split(':').map(Number);
  const total = (hours * 60 + minutes - recipeCookTimeMinutes + 24 * 60) % (24 * 60);
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** How many minutes short the configured reminder would leave the cook, if
 * the recipe's own time genuinely exceeds the reminder's lead time. 0 means
 * no shortfall — either the reminder gives enough (or more than enough)
 * notice, or there's no reminder configured at all to compare against.
 * Never used to silently change the reminder itself — only to decide
 * whether to show a "your recipe takes longer than your reminder" note. */
export function reminderShortfallMinutes(reminderOffsetMinutes: number, recipeCookTimeMinutes: number): number {
  if (reminderOffsetMinutes <= 0) return 0;
  return Math.max(0, recipeCookTimeMinutes - reminderOffsetMinutes);
}
