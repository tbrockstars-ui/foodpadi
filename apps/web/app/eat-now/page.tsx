import { isGuest, requireSessionOrGuest } from '../../lib/serverApi';
import { getGuestState } from '../../lib/guestSession';
import { EatNowSearchForm } from './EatNowSearchForm';
import { AppShell } from '../../components/AppShell';
import { GuestDisclaimerGate } from '../../components/GuestDisclaimerGate';
import shellStyles from '../app-shell.module.css';

/** Web counterpart to apps/mobile/src/screens/EatNowScreen.tsx. */
export default async function EatNowPage() {
  requireSessionOrGuest('/eat-now');
  const guest = isGuest();

  return (
    <AppShell guest={guest}>
      <main className={shellStyles.shellPage}>
        <GuestDisclaimerGate acknowledged={!guest || (getGuestState()?.disclaimerAcknowledged ?? false)}>
          <EatNowSearchForm isGuest={guest} />
        </GuestDisclaimerGate>
      </main>
    </AppShell>
  );
}
