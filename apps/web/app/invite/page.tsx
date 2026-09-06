import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReferralSummary } from '@foodpadi/shared';
import { redirectToLoginIfUnauthorized, requireSession, serverFetch } from '../../lib/serverApi';
import { AppShell } from '../../components/AppShell';
import shellStyles from '../app-shell.module.css';
import styles from './invite.module.css';
import { InviteView } from './InviteView';

export const metadata: Metadata = {
  title: 'Invite a friend · FoodPadi',
};

/**
 * "Feed a Friend" dashboard (docs/REFERRAL_PLAN.md, Phase 1a §2.5). Shows the
 * member's personal invite link, WhatsApp / copy share actions, and how many
 * friends have joined and gone on to actually use FoodPadi.
 * Mobile counterpart: the share entry in apps/mobile/src/screens/ProfileScreen.tsx
 * (InviteScreen), which the same "don't crash on a failed load" fix already
 * covers — this mirrors that behaviour for the server-rendered route.
 */
export default async function InvitePage() {
  requireSession('/invite');

  let summary: ReferralSummary | null = null;
  try {
    summary = await serverFetch<ReferralSummary>('/referrals/me');
  } catch (e) {
    // Stale session (access token expired, refresh token also dead) —
    // re-auth via login rather than dead-ending on the empty state below.
    redirectToLoginIfUnauthorized(e, '/invite');
    // API unreachable, or the endpoint errored — fall through to the empty
    // state below instead of taking down the whole route with an unhandled
    // "fetch failed".
  }

  return (
    <AppShell guest={false}>
      <main className={shellStyles.shellPage}>
        <h1 className={styles.title}>Invite a friend</h1>
        <p className={styles.lede}>
          Know someone who always says &ldquo;I don&apos;t know what to eat&rdquo;? Send them FoodPadi.
          When a friend joins through your link and makes their first food decision, it counts here.
        </p>
        {summary ? (
          <InviteView summary={summary} />
        ) : (
          <div className={styles.card}>
            <p className={styles.sectionLabel}>Couldn&apos;t load your invites</p>
            <p className={styles.hint}>
              Check your connection and try again. Inviting friends may not be available on this build
              yet.
            </p>
            <Link href="/invite" className={styles.copyButton} style={{ display: 'inline-block', marginTop: 'var(--space-md)', textDecoration: 'none' }}>
              Try again
            </Link>
          </div>
        )}
      </main>
    </AppShell>
  );
}
