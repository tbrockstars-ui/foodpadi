import Link from 'next/link';
import type { UserSummary } from '@foodpadi/shared';
import { ApiError, serverFetch } from '../lib/serverApi';
import { getTodaysTip } from '../lib/homeTips';
import { Logo } from './Logo';
import { SettingsMenu } from '../app/SettingsMenu';
import { UserAvatar } from './UserAvatar';
import { AppShellNav } from './AppShellNav';
import { ThemeToggle } from './ThemeToggle';
import styles from './AppShell.module.css';

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
  if (!guest) {
    try {
      me = await serverFetch<UserSummary>('/users/me');
    } catch (e) {
      // Stale/invalid cookie — same "fall through rather than crash the
      // route" precedent as app/page.tsx and app/guest/page.tsx. The page's
      // own requireSession() already handles the real redirect; this only
      // guards the topbar's optional avatar.
      if (!(e instanceof ApiError && (e.status === 401 || e.status === 404))) throw e;
    }
  }

  return (
    <div className={styles.shell}>
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
              <SettingsMenu />
              {me ? <UserAvatar displayName={me.displayName} email={me.email} /> : null}
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
