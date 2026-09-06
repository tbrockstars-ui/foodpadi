import { isGuest, requireSessionOrGuest } from '../../lib/serverApi';
import { getGuestState } from '../../lib/guestSession';
import { CookTodayForm } from './CookTodayForm';
import { AppShell } from '../../components/AppShell';
import { GuestDisclaimerGate } from '../../components/GuestDisclaimerGate';
import shellStyles from '../app-shell.module.css';

/** Web counterpart to apps/mobile/src/screens/CookTodayScreen.tsx. */
export default async function CookTodayPage() {
  requireSessionOrGuest('/cook-today');
  const guest = isGuest();

  return (
    <AppShell guest={guest}>
      <main className={shellStyles.shellPage}>
        <GuestDisclaimerGate acknowledged={!guest || (getGuestState()?.disclaimerAcknowledged ?? false)}>
          <CookTodayForm isGuest={guest} />
        </GuestDisclaimerGate>
      </main>
    </AppShell>
  );
}
