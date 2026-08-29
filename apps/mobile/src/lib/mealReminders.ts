import * as Notifications from 'expo-notifications';
import type { MealPlanItemView } from '@foodpadi/shared';

// Foreground behaviour — a reminder should still show as a banner/sound even
// while the app is open, not silently swallowed (the whole point is "don't
// let this slip past you").
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/** Call once (e.g. on app start, or right before scheduling the first reminder). */
export async function ensureNotificationPermission(): Promise<boolean> {
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

// Deterministic per-item identifier: scheduling again for the same item
// (e.g. the user changes the time) replaces the previous reminder instead
// of stacking a second one, with no need to track notification ids in
// component state.
function reminderIdentifier(itemId: string): string {
  return `meal-reminder-${itemId}`;
}

/**
 * Schedules (or reschedules) the "30 minutes to go" local reminder for one
 * meal-plan item — this is the actual feature behind the request: pick
 * cook-or-eat-out and a time per day, then get nudged before the window to
 * act on it closes. Local, on-device notifications only (no push
 * infrastructure) — this is mobile-only; the web app has no equivalent yet.
 *
 * Returns true if a reminder was actually scheduled, false if there was
 * nothing to schedule (no time set, or the time has already passed).
 */
export async function scheduleMealReminder(item: MealPlanItemView): Promise<boolean> {
  const identifier = reminderIdentifier(item.id);
  await Notifications.cancelScheduledNotificationAsync(identifier).catch(() => undefined);

  if (!item.plannedTime) return false;

  const [hours, minutes] = item.plannedTime.split(':').map(Number);
  const mealAt = new Date(item.plannedDate);
  mealAt.setHours(hours, minutes, 0, 0);
  const reminderAt = new Date(mealAt.getTime() - 30 * 60 * 1000);

  if (reminderAt.getTime() <= Date.now()) return false; // already in the past — nothing useful to schedule

  const granted = await ensureNotificationPermission();
  if (!granted) return false;

  const isEatOut = item.mealChoice === 'eat_out';
  const action = isEatOut ? 'order' : 'start cooking';
  const mealName = item.recipe?.title;

  await Notifications.scheduleNotificationAsync({
    identifier,
    content: {
      title: `30 minutes to ${action} 🍽️`,
      body: mealName
        ? `${mealName} is booked for ${item.plannedTime} — ${action} now so you're ready in time.`
        : `Your ${item.plannedTime} meal is coming up — time to ${action}.`,
      sound: true,
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: reminderAt },
  });

  return true;
}

/** Cancels a previously-scheduled reminder for one item (e.g. it was removed from the plan). */
export async function cancelMealReminder(itemId: string): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(reminderIdentifier(itemId)).catch(() => undefined);
}
