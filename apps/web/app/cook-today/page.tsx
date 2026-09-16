import { Suspense } from 'react';
import type { CookingJourneyView } from '@foodpadi/shared';
import { isGuest, requireSessionOrGuest, serverFetch } from '../../lib/serverApi';
import { getGuestState } from '../../lib/guestSession';
import { loadIdeaCards, loadPantrySummary, loadRecentlyCooked } from '../../lib/homeIdeas';
import { CookTodayForm } from './CookTodayForm';
import { AppShell } from '../../components/AppShell';
import { GuestDisclaimerGate } from '../../components/GuestDisclaimerGate';
// Home's own container (1280px max-width) rather than app-shell.module.css's
// narrower shellPage (880px) — Cook Today's two-column hubGrid (main + aside)
// wants the same width Home gives it, or every margin/proportion downstream
// (card widths, grid columns, whitespace) reads noticeably tighter than Home
// even though they share the exact same inner components/classes.
import homeStyles from '../home.module.css';

/** Web counterpart to apps/mobile/src/screens/CookTodayScreen.tsx. */
export default async function CookTodayPage() {
  requireSessionOrGuest('/cook-today');
  const guest = isGuest();

  // Members only: the persistent cooking journey (docs cooking-journey brief).
  // When one is active, CookTodayForm shows "Continue where you left off"
  // instead of the blank "What do you want to cook?" screen. Best-effort —
  // a failed load just falls back to the normal entry.
  let activeJourney: CookingJourneyView | null = null;
  if (!guest) {
    try {
      activeJourney = await serverFetch<CookingJourneyView | null>('/cooking-journey/active');
    } catch {
      activeJourney = null;
    }
  }

  // Same real "Ideas for you" / "Recently cooked" data Home shows (see
  // lib/homeIdeas.ts) — presented again here, once per page load, so Cook
  // Today's own blank entry screen isn't just a bare text box. No new data
  // source: identical GET /home/ideas + GET /home/recently-cooked calls.
  const [ideaCards, recentlyCooked, pantrySummary] = await Promise.all([
    loadIdeaCards(guest),
    loadRecentlyCooked(guest),
    loadPantrySummary(guest),
  ]);

  return (
    <AppShell guest={guest}>
      <main className={homeStyles.container}>
        <GuestDisclaimerGate acknowledged={!guest || (getGuestState()?.disclaimerAcknowledged ?? false)}>
          {/* CookTodayForm reads useSearchParams() (?prompt= from a "Cook It"
              tap — see DecideFlow.tsx) — same Suspense requirement as
              DecideFlow's own ?mood= handling on Home (HomeHub.tsx). */}
          <Suspense fallback={null}>
            <CookTodayForm
              isGuest={guest}
              initialJourney={activeJourney}
              ideaCards={ideaCards}
              recentlyCooked={recentlyCooked}
              pantrySummary={pantrySummary}
            />
          </Suspense>
        </GuestDisclaimerGate>
      </main>
    </AppShell>
  );
}
