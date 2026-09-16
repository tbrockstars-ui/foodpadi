import Link from 'next/link';
import { Suspense } from 'react';
import type { UserSummary } from '@foodpadi/shared';
import { DecideFlow } from './DecideFlow';
import { IntentCard } from '../components/motion/IntentCard';
import { AppShell } from '../components/AppShell';
import { GuestDisclaimerGate } from '../components/GuestDisclaimerGate';
import { MemberBenefitCard } from '../components/MemberBenefitCard';
import { FriendWelcomeBanner } from '../components/FriendWelcomeBanner';
import { LikeHeart } from '../components/LikeHeart';
import { IdeaCard } from '../components/IdeaCard';
import { IMAGE_ASSETS } from '../lib/imageAssets';
import { ApiError, serverFetch } from '../lib/serverApi';
import {
  loadIdeaCards,
  loadRecentlyCooked,
  type HomeIdeasSearchParams,
} from '../lib/homeIdeas';
import homeStyles from './home.module.css';

// First word of the account's display name, for the "Hi, <name>" greeting —
// same source UserAvatar already uses to derive initials.
function firstNameFrom(displayName: string | null): string | null {
  if (!displayName || !displayName.trim()) return null;
  return displayName.trim().split(/\s+/)[0];
}

// Same safe-fallback contract as AppShell's own '/users/me' call — the
// greeting is presentation only, so a stale cookie or brief API blip should
// just mean no greeting, not a broken page. A real 5xx still surfaces.
async function loadMe(guest: boolean): Promise<UserSummary | null> {
  if (guest) return null;
  try {
    return await serverFetch<UserSummary>('/users/me');
  } catch (e) {
    if (e instanceof ApiError && e.status >= 500) throw e;
    return null;
  }
}

// Data loading (GET /home/ideas, GET /home/recently-cooked) moved to
// lib/homeIdeas.ts — shared as-is with Cook Today's own "Good ideas for you"
// / "Recently cooked" sections (docs Cook-page-UI-pass 2026-09-11) rather
// than duplicated. Re-exported so `import { HomeIdeasSearchParams } from
// './HomeHub'` call sites (app/page.tsx) keep working unchanged.
export type { HomeIdeasSearchParams } from '../lib/homeIdeas';

const SUPPORT_EMAIL = 'support@foodpadi.app';

interface HubAction {
  key: string;
  label: string;
  subtitle: string;
  icon: string;
  href?: string;
  disabledTag?: string;
}

// Saved recipes is a real destination; Scan/Voice input need a camera/mic
// FoodPadi only has on mobile (docs/TECHNICAL_ARCHITECTURE.md §2.7) — same
// "App only" treatment Scan already had, just extended to Voice input for the
// same reason. Saved recipes needs an account, so it's dropped for guests
// rather than shown as a dead link.
function getQuickActions(guest: boolean): HubAction[] {
  const actions: HubAction[] = [
    { key: 'scan', icon: '/scan-food.png', label: 'Scan ingredients', subtitle: 'Use your camera', disabledTag: 'App only' },
    { key: 'voice', icon: '🎤', label: 'Voice input', subtitle: 'Tell me what you have', disabledTag: 'App only' },
  ];
  if (!guest) {
    actions.push({ key: 'saved', icon: '❤️', label: 'Saved recipes', subtitle: 'Your favourites', href: '/cook-today/saved' });
  }
  return actions;
}

export async function HomeHub({
  guest = false,
  guestDisclaimerAcknowledged = false,
  ideasSearchParams,
}: {
  guest?: boolean;
  guestDisclaimerAcknowledged?: boolean;
  /** Live mood/time/budget signals for "Ideas for you" — see buildIdeasQuery above. */
  ideasSearchParams?: HomeIdeasSearchParams;
}) {
  const [ideaCards, recentlyCooked, me] = await Promise.all([
    loadIdeaCards(guest, ideasSearchParams),
    loadRecentlyCooked(guest),
    loadMe(guest),
  ]);
  const firstName = firstNameFrom(me?.displayName ?? null);

  return (
    <AppShell guest={guest}>
      <main className={homeStyles.container}>
      {!guest ? <FriendWelcomeBanner /> : null}
      <div className={homeStyles.header}>
        {firstName ? <p className={homeStyles.greeting}>Hi, {firstName}</p> : null}
        <h1 className={homeStyles.heading}>
          What do you want to eat?
          <span className={homeStyles.headingIcon} aria-hidden="true">🍽️</span>
        </h1>
      </div>
      <p className={homeStyles.subheading}>Tell FoodPadi what you&apos;re in the mood for, and we&apos;ll help you decide.</p>

      {/* On wide screens the Decide flow (primary) and the direct-mode cards +
          Scan (secondary) sit side by side so the page fills its width rather
          than running as one tall centred column; the grid collapses to a
          single stacked column below 900px. */}
      <div className={homeStyles.hubGrid}>
        <div className={homeStyles.hubMain}>
          {/* DecideFlow reads useSearchParams() (to seed/sync ?mood=&maxBudget=
              for Ideas-for-you below) — Next.js requires that behind a
              Suspense boundary or the page throws a client-side exception in
              production builds (dev mode is more forgiving, which is why
              this only showed up once a prod build picked it up). */}
          <Suspense fallback={null}>
            {guest ? (
              <GuestDisclaimerGate acknowledged={guestDisclaimerAcknowledged}>
                <DecideFlow isGuest />
              </GuestDisclaimerGate>
            ) : (
              <DecideFlow />
            )}
          </Suspense>

          {/* Real feed from GET /home/ideas — the curated recipe pool scored
              against this member's pantry / cuisines / goals (see
              loadIdeaCards above). "You have X%" is a real pantry match and
              only shows when there's a pantry to score against. */}
          <div className={homeStyles.ideasHeader}>
            <h2 className={homeStyles.ideasHeading}>
              <span aria-hidden="true">✨</span> Ideas for you
            </h2>
          </div>
          <p className={homeStyles.ideasSubtext}>Based on your mood, time and budget</p>
          <div className={homeStyles.ideasGrid}>
            {ideaCards.map((idea) => (
              <IdeaCard key={idea.title} idea={idea} />
            ))}
          </div>

          <h2 className={homeStyles.quickActionsHeading}>Quick actions</h2>
          <div className={homeStyles.quickActionsGrid}>
            {getQuickActions(guest).map((action) => {
              const inner = (
                <>
                  {action.icon.startsWith('/') ? (
                    // eslint-disable-next-line @next/next/no-img-element -- tiny inline icon, no layout shift
                    <img src={action.icon} alt="" className={homeStyles.quickActionIcon} />
                  ) : (
                    <span className={homeStyles.quickActionEmoji} aria-hidden="true">
                      {action.icon}
                    </span>
                  )}
                  <span className={homeStyles.quickActionLabel}>{action.label}</span>
                  <span className={homeStyles.quickActionSubtitle}>{action.subtitle}</span>
                  {action.disabledTag ? <span className={homeStyles.soonTag}>{action.disabledTag}</span> : null}
                </>
              );
              return action.href ? (
                <Link key={action.key} href={action.href} className={homeStyles.quickActionCard}>
                  {inner}
                </Link>
              ) : (
                <span key={action.key} className={`${homeStyles.quickActionCard} ${homeStyles.quickActionCardDisabled}`}>
                  {inner}
                </span>
              );
            })}
          </div>
        </div>

        <div className={homeStyles.hubAside}>
          <div className={homeStyles.primaryGrid}>
            <IntentCard
              href="/cook-today"
              badge="🥕"
              label="Cooking with what you have"
              subtitle="Use ingredients you already have to cook something delicious."
              image={IMAGE_ASSETS.cooking}
              accent="cooking"
              cta="Get started"
            />
            <IntentCard
              href="/plan"
              badge="📅"
              label="Plan ahead"
              subtitle="Plan your meals and stay organised."
              image={IMAGE_ASSETS.planAhead}
              accent="plan-ahead"
              cta="Plan my meals"
            />
          </div>

          {/* Real cook history from GET /home/recently-cooked — see
              loadRecentlyCooked above. Guests never persist a cook, so
              there's nothing genuine to show them here; the MemberBenefitCard
              below already covers "create an account and FoodPadi remembers
              this for you". */}
          {!guest ? (
            <div className={homeStyles.recentCard}>
              <div className={homeStyles.recentHeader}>
                <p className={homeStyles.recentHeading}>Recently cooked</p>
                <Link href="/cook-today/saved" className={homeStyles.recentViewAll}>
                  View all
                </Link>
              </div>
              {recentlyCooked.length === 0 ? (
                <p className={homeStyles.recentEmpty}>
                  Finish a Cook Today session and it&apos;ll show up here.
                </p>
              ) : (
                recentlyCooked.map((item) => (
                  <div key={item.id} className={homeStyles.recentRow}>
                    <span className={homeStyles.recentThumbWrap}>
                      <img src={item.image.url} alt="" className={homeStyles.recentThumb} />
                      {item.isVegan ? (
                        <span className={homeStyles.recentThumbVegan} role="img" aria-label="Vegan" title="Vegan">
                          🌱
                        </span>
                      ) : null}
                    </span>
                    <div className={homeStyles.recentBody}>
                      <p className={homeStyles.recentTitle}>{item.title}</p>
                      <p className={homeStyles.recentWhen}>
                        {item.daysAgo === 0 ? 'Today' : item.daysAgo === 1 ? '1 day ago' : `${item.daysAgo} days ago`}
                      </p>
                    </div>
                    <LikeHeart label={item.title} variant="plain" recipeId={item.id} initialLiked={item.isFavorite} />
                  </div>
                ))
              )}
            </div>
          ) : null}

          {guest ? (
            <MemberBenefitCard
              icon="✨"
              title="Make FoodPadi yours"
              body="Deciding what to eat and Cook Today work without an account. Create a free one and FoodPadi remembers your recipes, your preferences and your plans."
              ctaLabel="Create free account"
            />
          ) : (
            /* "Feed a Friend" nudge — food is social; invite someone who never
               knows what to eat (docs/REFERRAL_PLAN.md §2.5). */
            <div className={homeStyles.inviteCard}>
              <span className={homeStyles.inviteCardIcon} aria-hidden="true">🍽️</span>
              <div className={homeStyles.inviteCardBody}>
                <p className={homeStyles.inviteCardText}>
                  Know someone who always says &ldquo;I don&apos;t know what to eat&rdquo;?
                </p>
                <Link href="/invite" className={homeStyles.inviteCardLink}>
                  Invite a friend →
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>

      <a
        className={homeStyles.supportFab}
        href={`mailto:${SUPPORT_EMAIL}`}
        aria-label="Contact support"
        title="Contact support"
      >
        <svg
          className={homeStyles.supportFabIcon}
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <path
            d="M4 5.5C4 4.67 4.67 4 5.5 4h13c.83 0 1.5.67 1.5 1.5v10c0 .83-.67 1.5-1.5 1.5H9l-4 3.5v-3.5H5.5C4.67 17 4 16.33 4 15.5v-10Z"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
          <circle cx="8.5" cy="10.5" r="1" fill="currentColor" />
          <circle cx="12" cy="10.5" r="1" fill="currentColor" />
          <circle cx="15.5" cy="10.5" r="1" fill="currentColor" />
        </svg>
      </a>
    </main>
    </AppShell>
  );
}
