import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { RequestActor } from '../auth/guest-or-auth.guard';
import { EAT_NOW_CATALOG, FoodIdea } from './eat-now-catalog';
import { estimateFor } from './eat-now-estimates';
import { SearchEatNowDto } from './dto/search-eat-now.dto';

export type FoodIdeaResult = FoodIdea & {
  distanceMiles: number;
  deliveryMinutesMin: number;
  deliveryMinutesMax: number;
  pricePenceMin: number;
  pricePenceMax: number;
};

const MAX_RESULTS = 5;

// "Something different" (the unified Home decision flow's wildcard chip) has
// no matching catalog tag by design — it means "surprise me", not a keyword.
// Recognising it here (rather than returning an empty, dead-end result) is a
// contained tweak to this existing matcher, not a new engine.
const SURPRISE_ME_TRIGGERS = ['different', 'surprise', 'anything', 'variety'];

// Plain substring matching on an unfiltered token list means a filler word
// like "a" (in "a nigerian dish") matches almost every entry as a substring
// of some other word — swamping a real, more specific token like "nigerian"
// that matched nothing. Stripping short/filler words before scoring (but
// after the surprise-trigger check above, which needs the raw tokens) fixes
// that without changing how real keywords are matched.
const STOP_WORDS = new Set([
  'a', 'an', 'the', 'of', 'to', 'for', 'and', 'or', 'in', 'on', 'me', 'my',
  'some', 'want', 'need', 'like', 'with', 'please', 'get', 'find', 'looking', 'fancy',
]);

function meaningfulTokens(queryTokens: string[]): string[] {
  return queryTokens.filter((token) => token.length >= 3 && !STOP_WORDS.has(token));
}

// A favourite-cuisine match only re-ranks within already-relevant results
// (see search() below) — it never pulls in a zero-keyword-match item, so a
// liked cuisine can't override what was actually searched for.
const FAVOURITE_CUISINE_BONUS = 1;

function shuffled<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// Rough pence ceilings per tier — a soft heuristic (like Plan Ahead's budget
// hint), not a real price. Kept alongside the catalog until we have real
// pricing to sort by.
const BUDGET_TIER_CEILING_PENCE: Record<FoodIdea['budgetTier'], number> = {
  low: 800,
  medium: 1500,
  high: Infinity,
};

function actorToAnalyticsFields(actor: RequestActor) {
  return actor.type === 'user' ? { userId: actor.userId } : { guestSessionId: actor.sessionId };
}

function ideaHaystack(idea: FoodIdea): string {
  return `${idea.title} ${idea.description} ${idea.cuisine} ${idea.tags.join(' ')}`.toLowerCase();
}

function scoreIdea(idea: FoodIdea, queryTokens: string[]): number {
  const haystack = ideaHaystack(idea);
  return queryTokens.reduce((score, token) => (haystack.includes(token) ? score + 1 : score), 0);
}

/**
 * Layer 4 ranking over a small, hand-curated MVP dataset (eat-now-catalog.ts)
 * — deterministic keyword matching, no LLM call. This is deliberately a
 * stand-in for a real UK product/restaurant data source (still not chosen —
 * docs/IMPLEMENTATION_PLAN.md Phase 4): good enough to make Eat Now usable
 * for the MVP without fabricating real restaurant/price/availability data.
 * The interface here is what a future Layer 5 (Claude-backed) ranking step
 * would slot behind, once a real data source exists.
 *
 * Personalised for signed-in users (docs/IMPLEMENTATION_PLAN.md's "smallest
 * product that makes someone return" principle): avoided ingredients are a
 * hard exclusion (same non-negotiable treatment as Cook Today/Plan Ahead),
 * favourite cuisines only re-rank within results that already matched the
 * query. Guests get the same matcher with no personalisation — there's
 * nothing stored for them to personalise from.
 */
@Injectable()
export class EatNowService {
  constructor(
    private readonly analytics: AnalyticsService,
    private readonly prisma: PrismaService,
  ) {}

  async search(dto: SearchEatNowDto, actor: RequestActor): Promise<FoodIdeaResult[]> {
    const rawTokens = dto.query.toLowerCase().split(/\s+/).filter(Boolean);
    const queryTokens = meaningfulTokens(rawTokens);
    const cuisineFilter = dto.cuisine?.trim().toLowerCase();

    const { favouriteCuisines, avoidedIngredients } = await this.loadPersonalisation(actor);

    const wantsSurprise = rawTokens.some((token) => SURPRISE_ME_TRIGGERS.includes(token));

    const filtered = EAT_NOW_CATALOG.filter((idea) => {
      if (cuisineFilter && !idea.cuisine.toLowerCase().includes(cuisineFilter)) return false;
      if (dto.maxPricePence && BUDGET_TIER_CEILING_PENCE[idea.budgetTier] > dto.maxPricePence) return false;
      if (avoidedIngredients.length > 0) {
        const haystack = ideaHaystack(idea);
        if (avoidedIngredients.some((ingredient) => haystack.includes(ingredient))) return false;
      }
      return true;
    });

    const results = wantsSurprise
      ? shuffled(filtered).slice(0, MAX_RESULTS)
      : filtered
          .map((idea) => ({ idea, score: scoreIdea(idea, queryTokens) }))
          .filter((entry) => entry.score > 0)
          .map((entry) => {
            // Substring, not exact equality — preference cuisines are full
            // labels like "British & comfort food" (PreferencesScreen's
            // CUISINES list) while a catalog entry may just say "British";
            // an exact-equality check would silently never match.
            const cuisine = entry.idea.cuisine.toLowerCase();
            const isFavourite = favouriteCuisines.some(
              (fav) => cuisine.includes(fav) || fav.includes(cuisine),
            );
            return { ...entry, score: entry.score + (isFavourite ? FAVOURITE_CUISINE_BONUS : 0) };
          })
          .sort((a, b) => b.score - a.score)
          .slice(0, MAX_RESULTS)
          .map((entry) => entry.idea);

    await this.analytics.track('eat_now_searched', actorToAnalyticsFields(actor), {
      resultCount: results.length,
    });

    return results.map((idea) => ({ ...idea, ...estimateFor(idea) }));
  }

  private async loadPersonalisation(
    actor: RequestActor,
  ): Promise<{ favouriteCuisines: string[]; avoidedIngredients: string[] }> {
    if (actor.type !== 'user') {
      return { favouriteCuisines: [], avoidedIngredients: [] };
    }

    const [preferences, avoided] = await Promise.all([
      this.prisma.foodPreference.findMany({
        where: { userId: actor.userId, deletedAt: null, cuisine: { not: null } },
      }),
      this.prisma.avoidedIngredient.findMany({ where: { userId: actor.userId, deletedAt: null } }),
    ]);

    return {
      favouriteCuisines: preferences
        .map((p) => p.cuisine?.toLowerCase())
        .filter((c): c is string => !!c),
      avoidedIngredients: avoided.map((a) => a.ingredientName.toLowerCase()),
    };
  }
}
