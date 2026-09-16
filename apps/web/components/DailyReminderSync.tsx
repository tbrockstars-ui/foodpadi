'use client';

import { useEffect } from 'react';
import type { DailyReminderPreferencesView } from '@foodpadi/shared';
import { fetchTodaysDedupContext, syncDailyReminders } from '../lib/dailyReminders';

/**
 * Invisible — re-arms today's Daily Companion Reminders (docs brief) on
 * every authenticated page load, mounted once from AppShell so it isn't
 * tied to any one page the way Plan Ahead's own re-arm (PlanView, on mount)
 * is. Fire-and-forget throughout: a failed fetch here must never break the
 * page it's mounted on.
 */
export function DailyReminderSync() {
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const prefsRes = await fetch('/api/proxy/users/me/daily-reminders');
        if (cancelled || !prefsRes.ok) return; // e.g. a stale/expired session
        const prefs = (await prefsRes.json()) as DailyReminderPreferencesView;
        const context = await fetchTodaysDedupContext();
        if (cancelled) return;
        await syncDailyReminders(prefs, context);
      } catch {
        // Best-effort only — see file header.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
