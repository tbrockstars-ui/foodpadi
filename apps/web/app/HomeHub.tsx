import Link from 'next/link';
import { Suspense } from 'react';
import { isVeganFood, type HomeIdeasResponse, type RecentlyCookedResponse } from '@foodpadi/shared';
import { DecideFlow } from './DecideFlow';
import { IntentCard } from '../components/motion/IntentCard';
import { AppShell } from '../components/AppShell';
import { GuestDisclaimerGate } from '../components/GuestDisclaimerGate';
import { MemberBenefitCard } from '../components/MemberBenefitCard';
import { FriendWelcomeBanner } from '../components/FriendWelcomeBanner';
import { LikeHeart } from '../components/LikeHeart';
import { IdeaCard, type IdeaCardData } from '../components/IdeaCard';
import { IMAGE_ASSETS, getCuisineImage, type ImageAsset } from '../lib/imageAssets';
import { HOME_IDEAS } from '../lib/homePlaceholders';
import { guestFetch, serverFetch } from '../lib/serverApi';
import homeStyles from './home.module.css';

// The live "what should I eat?" signals a caller (currently: a `/?mood=&
// maxTime=&maxBudget=` link/redirect; DecideFlow's own mood chips/budget
// field aren't wired to these yet) can pass through to GET /home/ideas — see
// home-ideas.ts's IdeaContext on the API side for how they're used.
export interface HomeIdeasSearchParams {
  mood?: string;
  maxTime?: string;
  maxBudget?: string;
}

function buildIdeasQuery(searchParams?: HomeIdeasSearchParams): string {
  if (!searchParams) return '';
  const params = new URLSearchParams();
  if (searchParams.mood?.trim()) params.set('mood', searchParams.mood.trim());
  if (searchParams.maxTime) params.set('maxTime', searchParams.maxTime);
  if (searchParams.maxBudget) params.set('maxBudget', searchParams.maxBudget);
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

// Rough per-recipe grocery-cost ranges for the £/££/£££ bands (home-ideas.ts's
// priceBandOf is a deterministic ingredient-count/premium-ingredient
// heuristic, not real pricing data — same "no real pricing data" constraint
// as Plan Ahead's budget steering). Shown as a hedged "~£x–y" estimate
// alongside the band symbol, never as a claimed exact cost.
const PRICE_BAND_ESTIMATE: Record<string, string> = {
  '£': '~£3–6',
  '££': '~£7–12',
  '£££': '~£13+',
};

function estimatedCostLabel(priceBand: string): string | null {
  return PRICE_BAND_ESTIMATE[priceBand] ?? null;
}

// Real "Ideas for you" from GET /home/ideas (curated pool scored against the
// member's pantry / preferences / goals — deterministic, no AI). Falls back
// to the static sample set only if that call fails, so the section always
// renders something rather than breaking Home.
async function loadIdeaCards(guest: boolean, searchParams?: HomeIdeasSearchParams): Promise<IdeaCardData[]> {
  const query = buildIdeasQuery(searchParams);
  try {
    const res = guest
      ? await guestFetch<HomeIdeasResponse>(`/home/ideas${query}`)
      : await serverFetch<HomeIdeasResponse>(`/home/ideas${query}`);
    const ideas = res?.ideas ?? [];
    if (ideas.length === 0) throw new Error('empty');
    return ideas.map((i) => ({
      title: i.title,
      timeMinutes: i.timeMinutes,
      difficulty: i.difficulty,
      priceBand: i.priceBand,
      priceEstimate: estimatedCostLabel(i.priceBand),
      matchPercent: i.matchPercent,
      badge: i.bestMatch ? 'Best match' : null,
      isVegan: isVeganFood({ title: i.title }),
      image: getCuisineImage(i.cuisine),
      recipe: guest ? undefined : i.recipe,
    }));
  } catch {
    return HOME_IDEAS.map((p) => ({
      title: p.title,
      timeMinutes: p.timeMinutes,
      difficulty: p.difficulty,
      priceBand: p.priceBand,
      priceEstimate: estimatedCostLabel(p.priceBand),
      matchPercent: p.matchPercent,
      badge: p.badge ?? null,
      isVegan: isVeganFood({ title: p.title }),
      image: p.image,
    }));
  }
}

interface RecentlyCookedCardData {
  id: string;
  title: string;
  daysAgo: number;
  image: ImageAsset;
  isFavorite: boolean;
  isVegan: boolean;
}

function daysAgo(iso: string): number {
  const ms = Date.now() - new Date(iso).getTime();
  return Math.max(0, Math.floor(ms / (24 * 60 * 60 * 1000)));
}

// Real "Recently cooked" from GET /home/recently-cooked — Recipe rows the
// member finished a guided Cook Today session for (Recipe.lastCookedAt; see
// CookTodayService.markCooked). Unlike loadIdeaCards above, an empty result
// is NOT swapped for the static sample set: that list is fabricated
// "you cooked this" history, and showing it to a member who genuinely
// hasn't cooked anything yet (or to a guest, who can't persist a cook at
// all) would just be lying to them. Empty stays empty; the card below
// renders a plain "nothing yet" line instead. A real fetch failure is
// treated the same as empty, for the same reason.
async function loadRecentlyCooked(guest: boolean): Promise<RecentlyCookedCardData[]> {
  if (guest) return [];
  try {
    const res = await serverFetch<RecentlyCookedResponse>('/home/recently-cooked');
    return (res?.items ?? []).map((item) => ({
      id: item.id,
      title: item.title,
      daysAgo: daysAgo(item.lastCookedAt),
      image: getCuisineImage(item.cuisine),
      isFavorite: item.isFavorite,
      isVegan: isVeganFood({ title: item.title }),
    }));
  } catch {
    return [];
  }
}

const SUPPORT_EMAIL = 'support@foodpadi.app';

interface HubAction {
  key: string;
  label: string;
  subtitle: string;
  icon: string;
  href?: string;
  disabledTag?: string;
}

// Pantry and Saved recipes are real destinations; Scan/Voice input need a
// camera/mic FoodPadi only has on mobile (docs/TECHNICAL_ARCHITECTURE.md
// §2.7) — same "App only" treatment Scan already had, just extended to
// Voice input for the same reason. Saved recipes needs an account, so it's
// dropped for guests rather than shown as a dead link.
function getQuickActions(guest: boolean): HubAction[] {
  const actions: HubAction[] = [
    { key: 'scan', icon: '/scan-food.png', label: 'Scan ingredients', subtitle: 'Use your camera', disabledTag: 'App only' },
    { key: 'voice', icon: '🎤', label: 'Voice input', subtitle: 'Tell me what you have', disabledTag: 'App only' },
    { key: 'pantry', icon: '🧺', label: 'Pantry', subtitle: 'See what you have', href: '/pantry' },
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
  const [ideaCards, recentlyCooked] = await Promise.all([
    loadIdeaCards(guest, ideasSearchParams),
    loadRecentlyCooked(guest),
  ]);

  return (
    <AppShell guest={guest}>
      <main className={homeStyles.container}>
      {!guest ? <FriendWelcomeBanner /> : null}
      <div className={homeStyles.header}>
        <h1 className={homeStyles.heading}>
          What should I eat?
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
