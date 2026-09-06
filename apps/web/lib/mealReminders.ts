import type { MealPlanItemView } from '@foodpadi/shared';

/**
 * Web counterpart to apps/mobile/src/lib/mealReminders.ts — same feature
 * (a "30 minutes to go" nudge before a planned meal's plannedTime), but a
 * meaningfully weaker mechanism: the web app has no service worker / push
 * subscription, so there's no OS-level scheduling to hand this to. A
 * reminder here is a plain `setTimeout` that fires a browser Notification —
 * it only survives as long as this tab stays open. PlanView re-arms every
 * item's reminder on mount for exactly that reason (a closed-then-reopened
 * tab has lost whatever was pending), same precedent as mobile re-arming on
 * app start. Callers should tell the user their tab needs to stay open,
 * since that's a real, honest limitation this can't hide.
 */

const REMINDER_LEAD_MS = 30 * 60 * 1000;
// setTimeout's delay is a 32-bit signed int internally — anything past this
// fires almost immediately instead of at the intended time. A meal plan is
// never scheduled this far ahead in practice, but chaining rather than
// trusting that keeps this correct regardless.
const MAX_TIMEOUT_MS = 2_147_483_647;

const scheduled = new Map<string, ReturnType<typeof setTimeout>>();

function hasNotificationSupport(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

/** Call before scheduling the first reminder (or any time you want to prompt). */
export async function ensureNotificationPermission(): Promise<boolean> {
  if (!hasNotificationSupport()) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  const result = await Notification.requestPermission();
  return result === 'granted';
}

function fireAt(identifier: string, delayMs: number, fire: () => void) {
  if (delayMs > MAX_TIMEOUT_MS) {
    scheduled.set(
      identifier,
      setTimeout(() => fireAt(identifier, delayMs - MAX_TIMEOUT_MS, fire), MAX_TIMEOUT_MS),
    );
    return;
  }
  scheduled.set(identifier, setTimeout(fire, delayMs));
}

// Distinguishes *why* nothing got scheduled — a single boolean would have
// blurred "the time's already passed" (nothing to do about it) together
// with "the browser won't let us notify" (fixable, and a materially
// different thing to tell the user).
export type MealReminderResult = 'scheduled' | 'no-time' | 'past' | 'permission-denied' | 'unsupported';

/**
 * Schedules (or reschedules) the "30 minutes to go" reminder for one
 * meal-plan item.
 */
export async function scheduleMealReminder(item: MealPlanItemView): Promise<MealReminderResult> {
  const identifier = item.id;
  const existing = scheduled.get(identifier);
  if (existing) clearTimeout(existing);
  scheduled.delete(identifier);

  if (!item.plannedTime) return 'no-time';

  const [hours, minutes] = item.plannedTime.split(':').map(Number);
  const mealAt = new Date(item.plannedDate);
  mealAt.setHours(hours, minutes, 0, 0);
  const reminderAt = mealAt.getTime() - REMINDER_LEAD_MS;
  const delayMs = reminderAt - Date.now();

  if (delayMs <= 0) return 'past'; // already in the past — nothing useful to schedule

  if (!hasNotificationSupport()) return 'unsupported';
  const granted = await ensureNotificationPermission();
  if (!granted) return 'permission-denied';

  const isEatOut = item.mealChoice === 'eat_out';
  const action = isEatOut ? 'order' : 'start cooking';
  const mealName = item.recipe?.title;

  fireAt(identifier, delayMs, () => {
    scheduled.delete(identifier);
    new Notification(`30 minutes to ${action} 🍽️`, {
      body: mealName
        ? `${mealName} is booked for ${item.plannedTime} — ${action} now so you're ready in time.`
        : `Your ${item.plannedTime} meal is coming up — time to ${action}.`,
    });
  });

  return 'scheduled';
}

/** Cancels a previously-scheduled reminder for one item (e.g. it was removed from the plan). */
export function cancelMealReminder(itemId: string): void {
  const existing = scheduled.get(itemId);
  if (existing) clearTimeout(existing);
  scheduled.delete(itemId);
}
