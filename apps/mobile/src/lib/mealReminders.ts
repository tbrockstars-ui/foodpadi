import type * as ExpoNotifications from 'expo-notifications';
import Constants from 'expo-constants';
import { effectivePlannedTime, effectiveReminderOffsetMinutes, type MealPlanItemView, type MealPlanView } from '@foodpadi/shared';

const notificationsUnavailable = Constants.appOwnership === 'expo';

// expo-notifications has a module-load side effect (auto device push-token
// registration) that unconditionally calls addPushTokenListener — which
// throws on Android Expo Go (SDK 53+ dropped remote push there). A static
// `import * as Notifications from 'expo-notifications'` at the top of this
// file runs that side effect the instant the file loads, crashing the whole
// app in Expo Go before any of the `notificationsUnavailable` guards below
// ever run. require()'d lazily, and only outside Expo Go, so the module
// itself is never loaded there — Metro's CommonJS require() (unlike the
// static `import` syntax) only executes at the call site, not hoisted.
let cached: typeof ExpoNotifications | null = null;
function loadNotifications(): typeof ExpoNotifications {
  if (!cached) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    cached = require('expo-notifications');
  }
  return cached!;
}

// Foreground behaviour — a reminder should still show as a banner/sound even
// while the app is open, not silently swallowed (the whole point is "don't
// let this slip past you").
if (!notificationsUnavailable) {
  loadNotifications().setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

/** Call once (e.g. on app start, or right before scheduling the first reminder). */
export async function ensureNotificationPermission(): Promise<boolean> {
  if (notificationsUnavailable) return false;

  const Notifications = loadNotifications();
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
 * Schedules (or reschedules) the "N minutes to go" local reminder for one
 * meal-plan item — this is the actual feature behind the request: pick
 * cook-or-eat-out and a time per day, then get nudged before the window to
 * act on it closes. Local, on-device notifications only (no push
 * infrastructure) — this is mobile-only; the web app has a meaningfully
 * weaker tab-must-stay-open equivalent (see apps/web/lib/mealReminders.ts).
 *
 * Both the eating time and the reminder lead time can come from the item's
 * own override or the plan's default (packages/shared/src/planTiming.ts) —
 * callers pass the whole plan, not just the item, so this always resolves
 * the same effective values the UI shows. An effective offset of 0 means
 * "no reminder for this day", by plan default or explicit per-day choice.
 *
 * Returns true if a reminder was actually scheduled, false if there was
 * nothing to schedule (no effective time, no reminder wanted, or the time
 * has already passed).
 */
export async function scheduleMealReminder(item: MealPlanItemView, plan: MealPlanView): Promise<boolean> {
  if (notificationsUnavailable) return false;

  const Notifications = loadNotifications();
  const identifier = reminderIdentifier(item.id);
  await Notifications.cancelScheduledNotificationAsync(identifier).catch(() => undefined);

  const plannedTime = effectivePlannedTime(item, plan);
  if (!plannedTime) return false;

  const offsetMinutes = effectiveReminderOffsetMinutes(item, plan);
  if (offsetMinutes <= 0) return false; // this day/plan explicitly wants no reminder

  const [hours, minutes] = plannedTime.split(':').map(Number);
  const mealAt = new Date(item.plannedDate);
  mealAt.setHours(hours, minutes, 0, 0);
  const reminderAt = new Date(mealAt.getTime() - offsetMinutes * 60 * 1000);

  if (reminderAt.getTime() <= Date.now()) return false; // already in the past — nothing useful to schedule

  const granted = await ensureNotificationPermission();
  if (!granted) return false;

  const isEatOut = item.mealChoice === 'eat_out';
  const action = isEatOut ? 'order' : 'start cooking';
  const mealName = item.recipe?.title;

  await Notifications.scheduleNotificationAsync({
    identifier,
    content: {
      title: `${offsetMinutes} minute${offsetMinutes === 1 ? '' : 's'} to ${action} 🍽️`,
      body: mealName
        ? `${mealName} is booked for ${plannedTime} — ${action} now so you're ready in time.`
        : `Your ${plannedTime} meal is coming up — time to ${action}.`,
      sound: true,
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: reminderAt },
  });

  return true;
}

/** Cancels a previously-scheduled reminder for one item (e.g. it was removed from the plan). */
export async function cancelMealReminder(itemId: string): Promise<void> {
  if (notificationsUnavailable) return;

  await loadNotifications()
    .cancelScheduledNotificationAsync(reminderIdentifier(itemId))
    .catch(() => undefined);
}
