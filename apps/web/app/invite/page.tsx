import type { Metadata } from 'next';
import type { ReferralSummary } from '@foodpadi/shared';
import { requireSession, serverFetch } from '../../lib/serverApi';
import { BackLink } from '../../components/BackLink';
import { Logo } from '../../components/Logo';
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
 * Mobile counterpart: the share entry in apps/mobile/src/screens/ProfileScreen.tsx.
 */
export default async function InvitePage() {
  requireSession('/invite');
  const summary = await serverFetch<ReferralSummary>('/referrals/me');

  return (
    <main className={shellStyles.container}>
      <Logo href="/" size={32} className={shellStyles.pageLogo} />
      <BackLink href="/" label="Home" />
      <h1 className={styles.title}>Invite a friend</h1>
      <p className={styles.lede}>
        Know someone who always says &ldquo;I don&apos;t know what to eat&rdquo;? Send them FoodPadi.
        When a friend joins through your link and makes their first food decision, it counts here.
      </p>
      <InviteView summary={summary} />
    </main>
  );
}
