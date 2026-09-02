import { Injectable } from '@nestjs/common';
import type { FoodImageView } from '@foodpadi/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { RequestActor } from '../auth/guest-or-auth.guard';
import { FoodImageService } from '../food-image/food-image.service';
import { BudgetTier, FoodIdea } from './eat-now-catalog';
import { estimateFor } from './eat-now-estimates';
import { SearchEatNowDto } from './dto/search-eat-now.dto';

export type FoodIdeaResult = FoodIdea & {
  distanceMiles: number;
  deliveryMinutesMin: number;
  deliveryMinutesMax: number;
  pricePenceMin: number;
  pricePenceMax: number;
  /** Representative photo, or null when none was found. Omitted when the caller opts out. */
  image?: FoodImageView | null;
};

interface SearchOptions {
  /**
   * Attach a representative photo to each result (default true). DecideService
   * passes false — it resolves images once over the final blended option set
   * instead, so a 12-result Eat Now search isn't run on the decide path.
   */
  resolveImages?: boolean;
}

// Raised alongside the catalog widening (eat-now-catalog.ts, 31 -> 68
// entries) — 5 was leaving plenty of relevant matches on the table for a
// broad query (e.g. a cuisine name) now that there's more to find.
const MAX_RESULTS = 12;

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
  'some', 'want', 'need', 'like', 'with', 'please', 'get', 'find', 'looking', 'fancy', 'bit',
]);

function meaningfulTokens(queryTokens: string[]): string[] {
  return queryTokens.filter((token) => token.length >= 3 && !STOP_WORDS.has(token));
}

// Levenshtein distance, capped/short-circuited at `max` — a query token more
// than `max` edits away from a candidate word can't possibly be a near-miss
// typo of it, so there's no need to finish computing the exact distance.
function levenshteinWithin(a: string, b: string, max: number): boolean {
  if (Math.abs(a.length - b.length) > max) return false;
  const prev = new Array(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    let rowMin = i;
    const curr = new Array(b.length + 1);
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      curr[j] = a[i - 1] === b[j - 1] ? prev[j - 1] : 1 + Math.min(prev[j - 1], prev[j], curr[j - 1]);
      rowMin = Math.min(rowMin, curr[j]);
    }
    if (rowMin > max) return false; // whole row exceeds budget — no cell ahead can recover
    prev.splice(0, prev.length, ...curr);
  }
  return prev[b.length] <= max;
}

// One typo of slack for a short word, two for a longer one — "spagetti" (one
// letter short of "spaghetti") should still match; "pizza" vs "salad"
// shouldn't. Never applied to words under 4 letters, where a 1-edit fuzzy
// match is more often a false positive (e.g. "egg" ~ "egg" is exact anyway,
// but "rat"~"rice" territory gets noisy fast on short words).
function fuzzyDistanceBudget(word: string): number {
  return word.length <= 6 ? 1 : 2;
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

function actorToAnalyticsFields(actor: RequestActor) {
  return actor.type === 'user' ? { userId: actor.userId } : { guestSessionId: actor.sessionId };
}

function ideaHaystack(idea: FoodIdea): string {
  return `${idea.title} ${idea.description} ${idea.cuisine} ${idea.tags.join(' ')}`.toLowerCase();
}

// Every distinct word in the haystack, for word-aware matching — raw
// substring matching (haystack.includes(token)) has a real false-positive
// problem: "egg" is a literal substring of "veggie", so a search for "egg"
// was scoring vegetarian/vegan entries as an egg match purely by accident.
function ideaWords(idea: FoodIdea): string[] {
  return [...new Set(ideaHaystack(idea).split(/[^a-z0-9]+/).filter(Boolean))];
}

// A word "matches" a token if either is a prefix of the other — catches
// simple pluralisation both ways ("egg" query / "eggs" in a description, or
// "chickens" query / "chicken" tag) without the substring-anywhere failure
// mode above ("veggie" does not start with "egg", and "egg" does not start
// with "veggie"). The length guard matters just as much as the prefix logic:
// splitting "Shepherd's" on punctuation leaves a stray 1-letter "s" word,
// and without a floor, "spicy".startsWith("s") is trivially true — every
// possessive apostrophe in the catalog would silently match every token
// starting with that letter.
function wordsMatch(word: string, token: string): boolean {
  if (word.length < 3 || token.length < 3) return false;
  return word.startsWith(token) || token.startsWith(word);
}

function hasWordMatch(idea: FoodIdea, token: string): boolean {
  return ideaWords(idea).some((word) => wordsMatch(word, token));
}

// A flat "+1 per matched token" lets a common word like "spicy" (tagged on
// a third of the catalog) drown out a specific dish/ingredient name that
// only one or two entries mention — e.g. "spaghetti with egg, a bit spicy"
// was ranking generic spicy dishes above the one entry actually about
// spaghetti. Weighting each token by how rare it is in the catalog (classic
// IDF) fixes that: a token nearly every entry contains is worth barely
// anything, one that appears in a single entry is worth a lot.
//
// Catalog is now DB-backed (admin/food-ideas, see docs/IMPLEMENTATION_PLAN.md)
// rather than the old EAT_NOW_CATALOG constant, so these take the active
// catalog as a parameter (fetched once per search() call) instead of closing
// over a module-level array.
function documentFrequency(token: string, catalog: FoodIdea[]): number {
  return catalog.reduce((count, idea) => (hasWordMatch(idea, token) ? count + 1 : count), 0);
}

function tokenWeight(token: string, catalog: FoodIdea[]): number {
  const df = documentFrequency(token, catalog);
  if (df === 0) return 0; // never appears verbatim anywhere — only the fuzzy path can still credit it
  return Math.log2(catalog.length / df) + 1;
}

/** One weight computed per query token, shared across every idea being scored. */
function weighTokens(queryTokens: string[], catalog: FoodIdea[]): { token: string; weight: number }[] {
  return queryTokens.map((token) => ({ token, weight: tokenWeight(token, catalog) }));
}

// A word (whole-word/prefix, per wordsMatch) match scores the token's full
// weight — a real signal. A typo (e.g. "spagetti" for "spaghetti") only
// gets 60% of that weight via levenshteinWithin, so a correctly-spelled
// exact match still edges out a near-miss for the same word.
function scoreIdea(
  idea: FoodIdea,
  weightedTokens: { token: string; weight: number }[],
  catalog: FoodIdea[],
): number {
  const words = ideaWords(idea); // computed once per idea, reused for both the exact and fuzzy passes
  return weightedTokens.reduce((score, { token, weight }) => {
    if (words.some((word) => wordsMatch(word, token))) return score + weight;
    if (token.length < 4) return score; // too short for fuzzy matching to be meaningful
    const budget = fuzzyDistanceBudget(token);
    // A misspelled token (e.g. "spagetti") has df=0 for itself — its weight
    // has to come from the real word it matched ("spaghetti"), not from the
    // typo, or a typo'd dish name would score as worthless as "spicy".
    const matchedWord = words.filter((word) => word.length >= 4).find((word) => levenshteinWithin(token, word, budget));
    return matchedWord ? score + tokenWeight(matchedWord, catalog) * 0.6 : score;
  }, 0);
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
    private readonly foodImage: FoodImageService,
  ) {}

  async search(
    dto: SearchEatNowDto,
    actor: RequestActor,
    options: SearchOptions = {},
  ): Promise<FoodIdeaResult[]> {
    // Strip punctuation before splitting — "egg," (a trailing comma from
    // "with egg, a bit spicy") is otherwise a token that can never match the
    // word "egg" in any catalog entry via substring matching.
    const rawTokens = dto.query
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
      .split(/\s+/)
      .filter(Boolean);
    const queryTokens = meaningfulTokens(rawTokens);
    const cuisineFilter = dto.cuisine?.trim().toLowerCase();

    const [catalog, { favouriteCuisines, avoidedIngredients }] = await Promise.all([
      this.loadCatalog(),
      this.loadPersonalisation(actor),
    ]);
    const weightedTokens = weighTokens(queryTokens, catalog);

    const wantsSurprise = rawTokens.some((token) => SURPRISE_ME_TRIGGERS.includes(token));

    // Computed once per idea, up front, so the budget filter below can check
    // this specific dish's own estimated price band rather than a whole
    // tier's ceiling (see the filter comment).
    const withEstimates = catalog.map((idea) => ({ idea, estimate: estimateFor(idea) }));

    const filtered = withEstimates.filter(({ idea, estimate }) => {
      if (cuisineFilter && !idea.cuisine.toLowerCase().includes(cuisineFilter)) return false;
      // Was comparing the user's budget against the whole tier's ceiling
      // (e.g. "medium" topping out at £13.50), which excluded EVERY
      // medium-tier dish under a modest budget even when a given dish's own
      // estimate fit comfortably — a £12 budget was silently ruling out
      // every pizza in the catalog (all "medium" tier) even ones estimated
      // at £9-£11. Comparing against this dish's own estimated minimum
      // instead only excludes it when it actually can't fit.
      if (dto.maxPricePence && estimate.pricePenceMin > dto.maxPricePence) return false;
      if (avoidedIngredients.length > 0) {
        const haystack = ideaHaystack(idea);
        if (avoidedIngredients.some((ingredient) => haystack.includes(ingredient))) return false;
      }
      return true;
    });

    const results = wantsSurprise
      ? shuffled(filtered).slice(0, MAX_RESULTS)
      : filtered
          .map((entry) => ({ ...entry, score: scoreIdea(entry.idea, weightedTokens, catalog) }))
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
          .slice(0, MAX_RESULTS);

    await this.analytics.track('eat_now_searched', actorToAnalyticsFields(actor), {
      resultCount: results.length,
      // Eat Now is deterministic (keyword scoring over the food_ideas
      // catalog) — no model call for anyone, guest or not.
      guest: actor.type === 'guest',
    });

    const enriched: FoodIdeaResult[] = results.map(({ idea, estimate }) => ({ ...idea, ...estimate }));

    if (options.resolveImages === false) return enriched;

    // A representative photo per result so the customer SEES what they're
    // choosing (visual-redesign brief). Best-effort and cached — a miss just
    // leaves image null and the card renders a placeholder.
    const images = await this.foodImage.resolveMany(
      enriched.map((idea) => ({ name: idea.title, cuisine: idea.cuisine })),
    );
    return enriched.map((idea) => ({ ...idea, image: images.get(idea.title) ?? null }));
  }

  // DB-backed catalog (admin/food-ideas) — `slug` becomes the public `id`
  // every other part of the app already keys on (FoodIdeaView.id, sent to
  // clients; eat-now-estimates.ts's stable per-dish hash), so estimates and
  // client behaviour are unchanged by the move off the old hardcoded array.
  // Small table (dozens of rows) — loading all active rows and scoring in
  // JS, same as the old in-memory array, needs no DB-side search/indexing.
  private async loadCatalog(): Promise<FoodIdea[]> {
    const rows = await this.prisma.foodIdea.findMany({ where: { isActive: true } });
    return rows.map((row) => ({
      id: row.slug,
      title: row.title,
      description: row.description,
      cuisine: row.cuisine,
      budgetTier: row.budgetTier as BudgetTier,
      tags: row.tags,
    }));
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
