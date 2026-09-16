import {
  DAILY_REMINDER_MEAL_TYPES,
  dayKindFor,
  effectivePlannedTime,
  genericReminderContent,
  scheduleForDate,
  shouldSuppressGenericReminder,
  type DailyReminderMealType,
  type DailyReminderPreferencesView,
  type MealPlanView,
} from '@foodpadi/shared';
import { ensureNotificationPermission } from './mealReminders';

/**
 * FoodPadi Daily Companion Reminders — the "it's around your usual
 * lunch/coffee time" nudge (docs brief). Same mechanism and same honest
 * limitation as apps/web/lib/mealReminders.ts (Plan Ahead's reminders): a
 * plain `setTimeout` + browser `Notification`, since the web app has no
 * service worker to hand real OS-level scheduling to. It only survives as
 * long as a tab stays open — DailyReminderSync.tsx re-arms today's
 * reminders on every authenticated page load for exactly that reason, same
 * precedent as PlanView re-arming Plan reminders on mount.
 */

// Same 32-bit setTimeout ceiling mealReminders.ts guards against — chained
// rather than trusted, though a same-day reminder never gets close to it.
const MAX_TIMEOUT_MS = 2_147_483_647;

const scheduled = new Map<string, ReturnType<typeof setTimeout>>();

// Deterministic per brief §43 ("foodpadi_daily_weekday_lunch") — this is
// what lets syncDailyReminders below cancel/replace a specific slot instead
// of ever accumulating duplicates.
function reminderId(dayKind: 'weekday' | 'weekend', mealType: DailyReminderMealType): string {
  return `daily-${dayKind}-${mealType}`;
}

function hasNotificationSupport(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

function cancelOne(id: string): void {
  const existing = scheduled.get(id);
  if (existing) clearTimeout(existing);
  scheduled.delete(id);
}

function fireAt(id: string, delayMs: number, fire: () => void): void {
  if (delayMs > MAX_TIMEOUT_MS) {
    scheduled.set(id, setTimeout(() => fireAt(id, delayMs - MAX_TIMEOUT_MS, fire), MAX_TIMEOUT_MS));
    return;
  }
  scheduled.set(id, setTimeout(fire, delayMs));
}

function trackDailyReminderEvent(eventType: 'daily_reminder_shown' | 'daily_reminder_opened', mealType: DailyReminderMealType) {
  fetch('/api/proxy/analytics/track', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ eventType, metadata: { mealType } }),
  }).catch(() => undefined);
}

export interface DailyReminderSyncContext {
  /** Meal slots ('breakfast'/'lunch'/'dinner') that today's accepted Plan
   * Ahead plan already covers with a resolved effective time — that slot's
   * OWN reminder (scheduleMealReminder, already named the real recipe)
   * covers it, so the generic nudge here should stay quiet (brief §11). */
  planSlotsToday: ReadonlySet<string>;
  /** Whether the user has an active Cooking Journey right now (brief §12). */
  hasActiveCookingJourney: boolean;
}

/**
 * Reconciles the 8 fixed slots (weekday/weekend × breakfast/lunch/dinner/
 * coffee) against what's actually running — cancels every one of them
 * first, then reschedules only what TODAY's effective schedule calls for
 * (brief §44: idempotent — calling this once or ten times in a row leaves
 * the same 0-4 timers armed). Only today's day-kind is ever armed; tomorrow
 * re-resolves whichever schedule tomorrow turns out to be on the next page
 * load, exactly like Plan Ahead's own reminders.
 */
export async function syncDailyReminders(
  prefs: DailyReminderPreferencesView,
  context: DailyReminderSyncContext,
): Promise<void> {
  for (const dayKind of ['weekday', 'weekend'] as const) {
    for (const mealType of DAILY_REMINDER_MEAL_TYPES) {
      cancelOne(reminderId(dayKind, mealType));
    }
  }

  // Global pause (brief §17) — the configured times themselves are never
  // touched here (they live server-side); this only decides what's armed.
  if (!prefs.enabled) return;
  if (!hasNotificationSupport()) return;

  const now = new Date();
  const dayKind = dayKindFor(now);
  const schedule = scheduleForDate(prefs, now);

  const anySlotWantsAReminder = DAILY_REMINDER_MEAL_TYPES.some((m) => schedule[m].enabled && schedule[m].time);
  if (!anySlotWantsAReminder) return;

  // Ask at most once (mealReminders.ts's ensureNotificationPermission never
  // re-prompts once granted or denied) — brief §18.
  const granted = await ensureNotificationPermission();
  if (!granted) return;

  for (const mealType of DAILY_REMINDER_MEAL_TYPES) {
    const slot = schedule[mealType];
    if (!slot.enabled || !slot.time) continue;

    const suppressed = shouldSuppressGenericReminder(mealType, {
      planCoversSlotToday: mealType !== 'coffee' && context.planSlotsToday.has(mealType),
      hasActiveCookingJourney: context.hasActiveCookingJourney,
    });
    if (suppressed) continue;

    const [hours, minutes] = slot.time.split(':').map(Number);
    const at = new Date(now);
    at.setHours(hours, minutes, 0, 0);
    const delayMs = at.getTime() - now.getTime();
    if (delayMs <= 0) continue; // already passed today — brief §33, never re-fire retroactively

    const id = reminderId(dayKind, mealType);
    const content = genericReminderContent(mealType);
    fireAt(id, delayMs, () => {
      scheduled.delete(id);
      trackDailyReminderEvent('daily_reminder_shown', mealType);
      const notification = new Notification(content.title, { body: content.body });
      notification.onclick = () => {
        trackDailyReminderEvent('daily_reminder_opened', mealType);
        window.focus();
        window.location.href = content.deepLink;
        notification.close();
      };
    });
  }
}

/**
 * Fetches just enough of today's Plan Ahead plan to know which meal slots it
 * already covers (brief §10/§11 — see DailyReminderSyncContext). Shared by
 * DailyReminderSync.tsx (on every page load) and the Settings/onboarding
 * forms (right after saving, so a change takes effect immediately rather
 * than waiting for the next page load).
 *
 * Deliberately never calls `/cooking-journey/active` to also feed the
 * "an active Cooking Journey should suppress the generic reminder" rule
 * (brief §12) — that endpoint has a real side effect
 * (CookingJourneyService.getActive fires a `cooking_journey_resumed`
 * Companion/Memory signal when the user has been away a while), and calling
 * it from every page load / every settings save would fire that signal far
 * more often than intended, polluting FoodPadi Memory's friction detector.
 * `hasActiveCookingJourney` is therefore always false here — a deliberate,
 * documented gap (the Plan Ahead half of the dedup is fully wired); a
 * follow-up could see that state safely from cook-today/page.tsx, which
 * already fetches it for its own reasons.
 */
export async function fetchTodaysDedupContext(): Promise<DailyReminderSyncContext> {
  const planSlotsToday = new Set<string>();
  try {
    const res = await fetch('/api/proxy/plan-ahead/current');
    if (res.ok) {
      const plan = (await res.json()) as MealPlanView | null;
      if (plan) {
        const todayKey = new Date().toDateString();
        for (const item of plan.items) {
          if (new Date(item.plannedDate).toDateString() !== todayKey) continue;
          if (effectivePlannedTime(item, plan)) planSlotsToday.add(item.mealSlot);
        }
      }
    }
  } catch {
    // Best-effort — an unreachable API just means no plan-based suppression.
  }
  return { planSlotsToday, hasActiveCookingJourney: false };
}

/** Cancels every armed daily reminder without touching stored preferences —
 * used nowhere today (a full-page logout navigation already tears down
 * every setTimeout in the tab for free, brief §24), kept as the explicit
 * escape hatch mirroring cancelMealReminder's shape. */
export function cancelAllDailyReminders(): void {
  for (const dayKind of ['weekday', 'weekend'] as const) {
    for (const mealType of DAILY_REMINDER_MEAL_TYPES) {
      cancelOne(reminderId(dayKind, mealType));
    }
  }
}
