import { isGuest, requireSessionOrGuest } from '../../lib/serverApi';
import { getGuestState } from '../../lib/guestSession';
import { CookTodayForm } from './CookTodayForm';
import { BackLink } from '../../components/BackLink';
import { GuestDisclaimerGate } from '../../components/GuestDisclaimerGate';
import { Logo } from '../../components/Logo';
import shellStyles from '../app-shell.module.css';

/** Web counterpart to apps/mobile/src/screens/CookTodayScreen.tsx. */
export default async function CookTodayPage() {
  requireSessionOrGuest('/cook-today');
  const guest = isGuest();

  return (
    <main className={shellStyles.container}>
      <Logo href="/" size={32} className={shellStyles.pageLogo} />
      <BackLink href="/" label="Home" />
      <GuestDisclaimerGate acknowledged={!guest || (getGuestState()?.disclaimerAcknowledged ?? false)}>
        <CookTodayForm isGuest={guest} />
      </GuestDisclaimerGate>
    </main>
  );
}
