import Link from 'next/link';
import type { UserSummary } from '@foodpadi/shared';
import { ApiError, serverFetch } from '../lib/serverApi';
import { getTodaysTip } from '../lib/homeTips';
import { Logo } from './Logo';
import { SettingsMenu } from '../app/SettingsMenu';
import { UserAvatar } from './UserAvatar';
import { AppShellNav } from './AppShellNav';
import { ThemeToggle } from './ThemeToggle';
import { DailyReminderSync } from './DailyReminderSync';
import styles from './AppShell.module.css';

/** "FoodPadi Trial · 5 days left" — server-rendered from the authoritative
 *  trialEndsAt, so it needs no client clock. */
function trialChipLabel(trialEndsAt: string | null): string {
  if (!trialEndsAt) return 'FoodPadi Trial';
  const msLeft = new Date(trialEndsAt).getTime() - Date.now();
  const daysLeft = Math.max(0, Math.ceil(msLeft / 86_400_000));
  if (daysLeft <= 0) return 'Trial ending — Upgrade';
  return `FoodPadi Trial · ${daysLeft} day${daysLeft === 1 ? '' : 's'} left`;
}

/**
 * Persistent sidebar + topbar wrapping every main-app page (Home, Cook
 * Today, Plan, Eat Now, Profile, Invite, Shopping list, saved lists) —
 * the web counterpart to the mobile 4-tab bottom bar, and the same
 * sidebar/topbar shape /admin already uses (admin/layout.tsx). Presentation
 * only: every route it wraps still does its own requireSession /
 * requireSessionOrGuest gating exactly as before.
 */
export async function AppShell({ guest, children }: { guest: boolean; children: React.ReactNode }) {
  let me: UserSummary | null = null;
  let isDealer = false;
  if (!guest) {
    const [meResult, dealerResult] = await Promise.allSettled([
      serverFetch<UserSummary>('/users/me'),
      serverFetch('/dealers/me'),
    ]);
    if (meResult.status === 'fulfilled') {
      me = meResult.value;
    } else if (meResult.reason instanceof ApiError && meResult.reason.status >= 500) {
      throw meResult.reason;
    }
    if (dealerResult.status === 'fulfilled') {
      isDealer = true;
    } else if (dealerResult.reason instanceof ApiError && dealerResult.reason.status >= 500) {
      throw dealerResult.reason;
    }
  }

  return (
    <div className={styles.shell}>
      {/* Account-only (brief §19 — same posture as every other preference
          surface: FoodGoal/FoodPreference/AvoidedIngredient/
          CompanionPreference are all account-only too). */}
      {!guest ? <DailyReminderSync /> : null}
      <aside className={styles.sidebar}>
        <Logo href="/" size={34} withWordmark className={styles.sidebarBrand} />
        <AppShellNav guest={guest} />
        <div className={styles.tipCard}>
          <p className={styles.tipHeading}>
            <span aria-hidden="true">✨</span> Today&apos;s tip
          </p>
          <p className={styles.tipBody}>{getTodaysTip()}</p>
        </div>
      </aside>

      <div className={styles.shellMain}>
        <header className={styles.topbar}>
          <span />
          {guest ? (
            <span className={styles.guestLinks}>
              <ThemeToggle />
              <Link href="/login" className={styles.guestLink}>
                Log in
              </Link>
              <Link href="/register" className={styles.guestLink}>
                Create account
              </Link>
            </span>
          ) : (
            <span className={styles.memberActions}>
              {me?.entitlement === 'trial' ? (
                <Link href="/premium" className={styles.trialChip}>
                  <span aria-hidden="true">✨</span> {trialChipLabel(me.trialEndsAt)}
                </Link>
              ) : null}
              <SettingsMenu isDealer={isDealer} />
              {me ? <UserAvatar displayName={me.displayName} email={me.email} avatarId={me.avatarId} /> : null}
            </span>
          )}
        </header>
        <div className={styles.shellContent}>{children}</div>

        {/* Persistent footer — docked at the bottom of every page's viewport
            (not just Home's), same idea as the topbar above. */}
        <footer className={styles.footerBanner}>
          <div className={styles.footerBannerText}>
            <p className={styles.footerBannerTitle}>FoodPadi is your AI cooking companion.</p>
            <p className={styles.footerBannerSubtitle}>Smarter suggestions. Less waste. Better meals.</p>
          </div>
          <div className={styles.footerBannerItems}>
            <span className={styles.footerBannerItem}>
              <span aria-hidden="true">🎯</span> Personalised for you
            </span>
            <span className={styles.footerBannerItem}>
              <span aria-hidden="true">⏱️</span> Saves money &amp; time
            </span>
            <span className={styles.footerBannerItem}>
              <span aria-hidden="true">♻️</span> Reduces food waste
            </span>
            <span className={styles.footerBannerItem}>
              <span aria-hidden="true">❤️</span> Learns your taste
            </span>
          </div>
        </footer>
      </div>
    </div>
  );
}
