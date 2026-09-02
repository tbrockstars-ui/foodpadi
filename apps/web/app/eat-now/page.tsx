import { isGuest, requireSessionOrGuest } from '../../lib/serverApi';
import { getGuestState } from '../../lib/guestSession';
import { EatNowSearchForm } from './EatNowSearchForm';
import { BackLink } from '../../components/BackLink';
import { GuestDisclaimerGate } from '../../components/GuestDisclaimerGate';
import { Logo } from '../../components/Logo';
import shellStyles from '../app-shell.module.css';

/** Web counterpart to apps/mobile/src/screens/EatNowScreen.tsx. */
export default async function EatNowPage() {
  requireSessionOrGuest('/eat-now');
  const guest = isGuest();

  return (
    <main className={shellStyles.container}>
      <Logo href="/" size={32} className={shellStyles.pageLogo} />
      <BackLink href="/" label="Home" />
      <GuestDisclaimerGate acknowledged={!guest || (getGuestState()?.disclaimerAcknowledged ?? false)}>
        <EatNowSearchForm isGuest={guest} />
      </GuestDisclaimerGate>
    </main>
  );
}
