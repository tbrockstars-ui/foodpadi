import type { DailyReminderPreferencesView } from '@foodpadi/shared';
import { redirectToLoginIfUnauthorized, requireSession, serverFetch } from '../../lib/serverApi';
import { AppShell } from '../../components/AppShell';
import { Logo } from '../../components/Logo';
import shellStyles from '../app-shell.module.css';
import { DailyRemindersForm } from './DailyRemindersForm';

export const dynamic = 'force-dynamic';

/**
 * FoodPadi Daily Companion Reminders (docs brief). Two entry points share
 * this one page: the optional, skippable last onboarding step
 * (?onboarding=1, arrived at from /avoid-foods — onboarding itself is
 * already marked complete by then) and Settings → Daily Reminders (no
 * query param — reachable any time after, brief §14/§38).
 */
export default async function DailyRemindersPage({
  searchParams,
}: {
  searchParams: { onboarding?: string };
}) {
  requireSession('/daily-reminders');
  const isOnboarding = searchParams.onboarding === '1';

  let prefs: DailyReminderPreferencesView | null = null;
  try {
    prefs = await serverFetch<DailyReminderPreferencesView>('/users/me/daily-reminders');
  } catch (e) {
    redirectToLoginIfUnauthorized(e, '/daily-reminders');
  }

  const body = prefs ? (
    <DailyRemindersForm initial={prefs} mode={isOnboarding ? 'onboarding' : 'settings'} />
  ) : (
    <p>Couldn&apos;t load your reminder settings. Please try again.</p>
  );

  if (isOnboarding) {
    return (
      <main className={shellStyles.container}>
        <Logo href="/" size={38} className={shellStyles.pageLogo} />
        {body}
      </main>
    );
  }

  return (
    <AppShell guest={false}>
      <main className={shellStyles.shellPage}>{body}</main>
    </AppShell>
  );
}
