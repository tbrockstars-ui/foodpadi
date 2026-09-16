'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  DAILY_REMINDER_MEAL_TYPES,
  SUGGESTED_DAILY_REMINDER_TIMES,
  type DailyReminderDaySchedule,
  type DailyReminderMealType,
  type DailyReminderPreferencesView,
} from '@foodpadi/shared';
import { ensureNotificationPermission } from '../../lib/mealReminders';
import { fetchTodaysDedupContext, syncDailyReminders } from '../../lib/dailyReminders';
import onboardingStyles from '../onboarding.module.css';
import styles from './daily-reminders.module.css';

const MEAL_LABELS: Record<DailyReminderMealType, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  coffee: 'Coffee',
};

const MEAL_EMOJI: Record<DailyReminderMealType, string> = {
  breakfast: '🍳',
  lunch: '🍽️',
  dinner: '🍲',
  coffee: '☕',
};

// Pre-fills an unset slot's time with the labelled suggestion (brief §37) —
// purely a starting point for the input; it's only ever saved once the user
// actually enables that slot and taps Continue/Save.
function withSuggestedDefaults(prefs: DailyReminderPreferencesView): DailyReminderPreferencesView {
  const fill = (kind: 'weekday' | 'weekend', schedule: DailyReminderDaySchedule): DailyReminderDaySchedule => {
    const next = { ...schedule };
    for (const mealType of DAILY_REMINDER_MEAL_TYPES) {
      if (!next[mealType].time) {
        next[mealType] = { ...next[mealType], time: SUGGESTED_DAILY_REMINDER_TIMES[kind][mealType] };
      }
    }
    return next;
  };
  return { ...prefs, weekday: fill('weekday', prefs.weekday), weekend: fill('weekend', prefs.weekend) };
}

interface Props {
  initial: DailyReminderPreferencesView;
  /** Onboarding shows "Forget to eat sometimes?" copy + Continue/Skip;
   * Settings shows a plain Save. Both are otherwise the same form. */
  mode: 'onboarding' | 'settings';
}

/**
 * FoodPadi Daily Companion Reminders (docs brief) — configure weekday/
 * weekend breakfast/lunch/dinner/coffee reminder times. Used both as the
 * (optional, skippable) last onboarding step and from Settings, per the
 * brief's own requirement that both entry points exist.
 */
export function DailyRemindersForm({ initial, mode }: Props) {
  const router = useRouter();
  const [draft, setDraft] = useState<DailyReminderPreferencesView>(() => withSuggestedDefaults(initial));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>('default');

  useEffect(() => {
    setPermission(typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'unsupported');
  }, []);

  const setSlot = (
    kind: 'weekday' | 'weekend',
    mealType: DailyReminderMealType,
    patch: Partial<{ enabled: boolean; time: string }>,
  ) => {
    setSaved(false);
    setDraft((d) => ({
      ...d,
      [kind]: { ...d[kind], [mealType]: { ...d[kind][mealType], ...patch } },
    }));
  };

  const save = async (andContinue: boolean) => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/proxy/users/me/daily-reminders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enabled: draft.enabled,
          weekday: draft.weekday,
          weekend: draft.weekend,
          source: mode,
        }),
      });
      if (!res.ok) throw new Error('save failed');
      const saved = (await res.json()) as DailyReminderPreferencesView;

      const anyEnabled = DAILY_REMINDER_MEAL_TYPES.some(
        (m) => saved.weekday[m].enabled || saved.weekend[m].enabled,
      );
      if (anyEnabled) {
        await ensureNotificationPermission();
        setPermission(typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'unsupported');
      }

      // Re-arm immediately rather than waiting for the next page load.
      const context = await fetchTodaysDedupContext();
      await syncDailyReminders(saved, context);

      if (andContinue) {
        router.push('/');
      } else {
        setDraft(withSuggestedDefaults(saved));
        setSaved(true);
      }
    } catch {
      setError("Couldn't save your reminders. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const daySection = (kind: 'weekday' | 'weekend', title: string) => (
    <div className={styles.dayGroup}>
      <p className={styles.dayHeading}>{title}</p>
      <div className={styles.card}>
        {DAILY_REMINDER_MEAL_TYPES.map((mealType) => {
          const slot = draft[kind][mealType];
          return (
            <div key={mealType} className={styles.row}>
              <div className={styles.rowMain}>
                <span className={styles.rowLabel}>
                  <span aria-hidden="true">{MEAL_EMOJI[mealType]}</span> {MEAL_LABELS[mealType]}
                </span>
              </div>
              <input
                type="time"
                className={styles.timeInput}
                value={slot.time ?? ''}
                disabled={!draft.enabled}
                onChange={(e) => setSlot(kind, mealType, { time: e.target.value })}
                aria-label={`${title} ${MEAL_LABELS[mealType]} time`}
              />
              <label className={styles.switch}>
                <input
                  type="checkbox"
                  className={styles.switchInput}
                  checked={slot.enabled}
                  disabled={!draft.enabled}
                  onChange={(e) => setSlot(kind, mealType, { enabled: e.target.checked })}
                  aria-label={`${title} ${MEAL_LABELS[mealType]} reminder`}
                />
                <span className={styles.switchTrack} aria-hidden="true" />
                <span className={styles.switchThumb} aria-hidden="true" />
              </label>
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <div>
      {mode === 'onboarding' ? (
        <>
          <h1 className={onboardingStyles.heading}>When do you usually eat?</h1>
          <p className={onboardingStyles.subtitle}>
            Forget to eat sometimes? FoodPadi can gently remind you when it&apos;s usually time for food or
            coffee. Totally optional, and you can change or turn this off anytime.
          </p>
        </>
      ) : (
        <>
          <h1 className={onboardingStyles.heading}>Daily Reminders</h1>
          <p className={onboardingStyles.subtitle}>Let FoodPadi remind you around your usual eating and coffee times.</p>
        </>
      )}

      <div className={styles.globalRow}>
        <div>
          <p className={styles.globalLabel}>Daily Companion Reminders</p>
          <p className={styles.globalHint}>Off pauses reminders without losing your times.</p>
        </div>
        <label className={styles.switch}>
          <input
            type="checkbox"
            className={styles.switchInput}
            checked={draft.enabled}
            onChange={(e) => {
              setSaved(false);
              const turningOn = e.target.checked;
              setDraft((d) => {
                if (!turningOn) return { ...d, enabled: false };
                // Turning the master switch on starts every slot enabled —
                // the user then turns off whichever they don't want, rather
                // than the master coming on with nothing actually reminding
                // them (user instruction 2026-09-12).
                const enableAll = (schedule: DailyReminderDaySchedule): DailyReminderDaySchedule => {
                  const next = { ...schedule };
                  for (const mealType of DAILY_REMINDER_MEAL_TYPES) {
                    next[mealType] = { ...next[mealType], enabled: true };
                  }
                  return next;
                };
                return { ...d, enabled: true, weekday: enableAll(d.weekday), weekend: enableAll(d.weekend) };
              });
            }}
            aria-label="Daily Companion Reminders"
          />
          <span className={styles.switchTrack} aria-hidden="true" />
          <span className={styles.switchThumb} aria-hidden="true" />
        </label>
      </div>

      {draft.enabled && permission === 'default' ? (
        <div className={styles.permissionNotice}>
          <p className={styles.permissionText}>Allow notifications so FoodPadi can remind you.</p>
          <button
            type="button"
            className={styles.permissionButton}
            onClick={async () => {
              await ensureNotificationPermission();
              setPermission(typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'unsupported');
            }}
          >
            Allow Notifications
          </button>
        </div>
      ) : null}
      {draft.enabled && permission === 'denied' ? (
        <div className={styles.permissionNotice}>
          <p className={styles.permissionText}>
            Notifications are off. Enable them for this site in your browser to receive reminders.
          </p>
        </div>
      ) : null}

      {daySection('weekday', 'Weekdays')}
      {daySection('weekend', 'Weekends')}

      {error ? <p className={onboardingStyles.errorText}>{error}</p> : null}
      {saved ? <p className={styles.savedNotice}>Saved.</p> : null}

      {mode === 'onboarding' ? (
        <>
          <div className={onboardingStyles.buttonRow}>
            <button
              type="button"
              className={onboardingStyles.primaryButton}
              onClick={() => save(true)}
              disabled={saving}
            >
              {saving ? 'Saving…' : 'Continue'}
            </button>
          </div>
          <button type="button" className={styles.skipLink} onClick={() => router.push('/')} disabled={saving}>
            Skip for now
          </button>
        </>
      ) : (
        <div className={onboardingStyles.buttonRow}>
          <button
            type="button"
            className={onboardingStyles.primaryButton}
            onClick={() => save(false)}
            disabled={saving}
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      )}
    </div>
  );
}
