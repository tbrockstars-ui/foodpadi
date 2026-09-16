import {
  isVeganFood,
  type HomeIdeasResponse,
  type PantryItemsResponse,
  type RecentlyCookedResponse,
} from '@foodpadi/shared';
import { getCuisineImage, type ImageAsset } from './imageAssets';
import { HOME_IDEAS } from './homePlaceholders';
import { guestFetch, serverFetch } from './serverApi';

// Shared between Home (HomeHub.tsx) and Cook Today (app/cook-today/page.tsx)
// — both surface the same real "Ideas for you" / "Recently cooked" data, so
// the fetch + mapping lives here once rather than twice. Pure data loading,
// no JSX — pulled out of HomeHub.tsx unchanged (docs Cook-page-UI-pass
// 2026-09-11).

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

export interface IdeaCardData {
  title: string;
  timeMinutes: number;
  difficulty: string;
  priceBand: string;
  priceEstimate: string | null;
  matchPercent: number | null;
  badge: string | null;
  isVegan: boolean;
  image: ImageAsset;
  recipe?: import('@foodpadi/shared').RecipeView;
}

// Real "Ideas for you" from GET /home/ideas (curated pool scored against the
// member's pantry / preferences / goals — deterministic, no AI). Falls back
// to the static sample set only if that call fails, so the section always
// renders something rather than breaking.
export async function loadIdeaCards(guest: boolean, searchParams?: HomeIdeasSearchParams): Promise<IdeaCardData[]> {
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

export interface RecentlyCookedCardData {
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
// is NOT swapped for a static sample set: that would be fabricated "you
// cooked this" history. Empty stays empty; the caller renders a plain
// "nothing yet" line instead. A real fetch failure is treated the same as
// empty, for the same reason. Guests never persist a cook, so this is
// members-only — always [] for a guest.
export interface PantrySummaryItem {
  id: string;
  name: string;
  /** "400g" style — only when the item actually has a stored quantity/unit;
   * never a fabricated remaining-count. */
  quantityLabel: string | null;
}

// Cook Today's "Use These First" (docs Cook-page-redesign brief §15) — the
// user's own oldest-added pantry items, a real (if approximate) stand-in for
// "these might need using soon" since PantryItem has no expiry/freshness
// field. Members only; a guest has no pantry. Empty pantry -> empty array,
// rendered as the section's own honest empty state, never fabricated items.
export async function loadPantrySummary(guest: boolean, limit = 3): Promise<PantrySummaryItem[]> {
  if (guest) return [];
  try {
    const res = await serverFetch<PantryItemsResponse>('/pantry/items');
    return (res?.items ?? []).slice(0, limit).map((item) => ({
      id: item.id,
      name: item.name,
      quantityLabel: [item.quantity, item.unit].filter(Boolean).join(' ') || null,
    }));
  } catch {
    return [];
  }
}

export async function loadRecentlyCooked(guest: boolean): Promise<RecentlyCookedCardData[]> {
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
