// The deterministic Food Dealer search-ranking model (dealer brief §10/§37/§81).
// Pure — no I/O, no AI, no clock (the caller passes `openNow`). Unit-tested
// against the brief's critical ranking test.
//
// CORE INVARIANT (brief §81 / user instruction 2026-09-09): payment can raise
// visibility, it can NEVER make an irrelevant result relevant. A dealer with no
// genuine term match is dropped entirely. A subscribed dealer only enters a
// Featured slot when it ALSO clears the relevance + locality floors, and even
// then it is ordered by the same organic score — a poor match never outranks a
// strong local one just because it pays.

import { DEALER_RATING_MIN_FOR_RANKING } from '@foodpadi/shared';
import { normaliseTerm, singularise, tokenise } from './dealer-taxonomy';

export interface RankableDealer {
  id: string;
  slug: string;
  dealerType: string;
  /** Original-case, for `matchedTerms` display. */
  name: string;
  products: string[];
  categories: string[];
  cuisines: string[];
  /** Normalised (lowercased, accent/punct-stripped) — for matching. */
  nameNorm: string;
  productsNorm: string[];
  categoriesNorm: string[];
  cuisinesNorm: string[];
  descriptionNorm: string;
  localities: string[]; // normalised
  primaryLat: number | null;
  primaryLng: number | null;
  completeness: number; // 0–100
  featuredEligible: boolean;
  isVerified: boolean;
  /** true / false when opening hours were cleanly parseable, else null (unknown). */
  openNow: boolean | null;
  /** Post-visit customer ratings (user instruction 2026-09-11). null average =
      no ratings yet — treated as neutral, never as a bad score. */
  ratingAverage: number | null;
  ratingCount: number;
}

export interface ParsedQuery {
  /** Normalised + singularised query tokens (locality token removed). */
  terms: string[];
  /** The whole normalised query minus the locality — for an exact product-name match. */
  phrase: string;
  locality: string | null; // normalised
  origin: { lat: number; lng: number } | null;
  category: string | null; // normalised
  dealerType: string | null;
}

export interface RankedDealer {
  dealer: RankableDealer;
  relevance: number;
  locality: number;
  organicScore: number;
  distanceMiles: number | null;
  matchedTerms: string[];
  isSponsored: boolean;
}

export interface DealerRankingResult {
  featured: RankedDealer[];
  organic: RankedDealer[];
}

// Weights — relevance dominates; the subscription/Featured decision is a
// separate gate, never a ranking weight (brief §45: no "pay more to rank higher").
// `trust` carries more weight than it used to (user instruction 2026-09-11:
// verified dealers should be visibly prioritised) — but its gap between
// verified/unverified (below) is still far smaller than a relevance-tier gap,
// so a verified-but-irrelevant dealer can never outrank a relevant one.
const W = { relevance: 0.42, locality: 0.26, quality: 0.12, availability: 0.05, trust: 0.15 };

export const RELEVANCE_FLOOR = 0.5;
export const LOCALITY_FLOOR = 0.5;
export const FEATURED_SLOTS = 3;

const R = { product: 1, category: 0.7, cuisine: 0.7, name: 0.6, description: 0.3 };

function wordHit(haystack: string, needle: string): boolean {
  if (!haystack || !needle) return false;
  if (haystack === needle) return true;
  return new RegExp(`(^|\\s)${escapeRe(needle)}(\\s|$)`).test(haystack);
}
function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// --------------------------------------------------------------------------
// Query parsing — deterministic, reuses the same tokenisation the portal uses
// so a stored term and a query term compare the same way (brief §36). A
// trailing/leading known locality token is split off when `knownLocalities`
// contains it, so "egusi leicester" → terms:["egusi"], locality:"leicester".

export function parseDealerQuery(
  raw: string,
  opts: {
    locality?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    category?: string | null;
    dealerType?: string | null;
    knownLocalities?: Iterable<string>;
  } = {},
): ParsedQuery {
  const known = new Set([...(opts.knownLocalities ?? [])].map((l) => normaliseTerm(l)));
  const normalisedRaw = normaliseTerm(raw ?? '');
  let words = normalisedRaw.split(' ').filter(Boolean);

  let locality = opts.locality ? normaliseTerm(opts.locality) : null;

  // Pull a locality out of the free text: the longest suffix (up to 3 words) or
  // prefix that is a known locality.
  if (!locality && known.size && words.length > 1) {
    for (let n = Math.min(3, words.length - 1); n >= 1; n--) {
      const suffix = words.slice(-n).join(' ');
      const prefix = words.slice(0, n).join(' ');
      if (known.has(suffix)) {
        locality = suffix;
        words = words.slice(0, -n);
        break;
      }
      if (known.has(prefix)) {
        locality = prefix;
        words = words.slice(n);
        break;
      }
    }
  }
  // Also strip a bare "near"/"in" left dangling.
  words = words.filter((w) => w !== 'near' && w !== 'in');

  const terms = [...new Set(tokenise(words.join(' ')).map(singularise))];
  return {
    terms,
    phrase: words.join(' ').trim(),
    locality,
    origin:
      typeof opts.latitude === 'number' && typeof opts.longitude === 'number'
        ? { lat: opts.latitude, lng: opts.longitude }
        : null,
    category: opts.category ? normaliseTerm(opts.category) : null,
    dealerType: opts.dealerType ?? null,
  };
}

// --------------------------------------------------------------------------
// Relevance

interface RelevanceResult {
  score: number;
  matched: string[];
}

export function computeRelevance(d: RankableDealer, q: ParsedQuery): RelevanceResult {
  if (q.terms.length === 0 && !q.phrase) {
    // No query text — a pure "food dealers near me" browse. Every listed dealer
    // is a candidate; relevance is neutral-positive so locality/quality decide.
    return { score: 0.5, matched: [] };
  }

  let score = 0;
  const matched = new Set<string>();

  const scan = (
    normList: string[],
    displayList: string[],
    level: number,
    label: 'product' | 'category' | 'cuisine',
  ) => {
    for (let i = 0; i < normList.length; i++) {
      const entry = normList[i];
      const entryTokens = new Set(entry.split(' ').map(singularise));
      const phraseHit = q.phrase && (entry === q.phrase || entry.includes(q.phrase));
      const tokenHit = q.terms.some((t) => entryTokens.has(t) || wordHit(entry, t));
      if (phraseHit || tokenHit) {
        score = Math.max(score, level);
        matched.add(displayList[i] ?? entry);
        if (label !== 'product') {
          // categories/cuisines are broader — still record for chips
        }
      }
    }
  };

  scan(d.productsNorm, d.products, R.product, 'product');
  scan(d.categoriesNorm, d.categories, R.category, 'category');
  scan(d.cuisinesNorm, d.cuisines, R.cuisine, 'cuisine');

  // Business name
  if (q.terms.some((t) => wordHit(d.nameNorm, t)) || (q.phrase && d.nameNorm.includes(q.phrase))) {
    score = Math.max(score, R.name);
    matched.add(d.name);
  }
  // Description — weakest evidence, never enough on its own to feel like a match
  if (score === 0 && q.terms.some((t) => wordHit(d.descriptionNorm, t))) {
    score = R.description;
  }

  // A category filter that the dealer doesn't carry knocks it out.
  if (q.category && !d.categoriesNorm.some((c) => wordHit(c, q.category!) || c.includes(q.category!))) {
    return { score: 0, matched: [] };
  }

  return { score, matched: [...matched].slice(0, 4) };
}

// --------------------------------------------------------------------------
// Locality / proximity

export function haversineMiles(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const Rm = 3958.8;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return Rm * (2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h)));
}

function distanceBucket(miles: number): number {
  if (miles <= 1) return 1;
  if (miles <= 3) return 0.8;
  if (miles <= 10) return 0.5;
  if (miles <= 25) return 0.3;
  return 0.15;
}

export function computeLocality(
  d: RankableDealer,
  q: ParsedQuery,
): { score: number; distanceMiles: number | null } {
  const distanceMiles =
    q.origin && d.primaryLat != null && d.primaryLng != null
      ? haversineMiles(q.origin, { lat: d.primaryLat, lng: d.primaryLng })
      : null;

  if (q.locality) {
    const exact = d.localities.some((l) => l === q.locality);
    if (exact) return { score: 1, distanceMiles };
    const partial = d.localities.some((l) => l.includes(q.locality!) || q.locality!.includes(l));
    if (partial) return { score: 0.7, distanceMiles };
    // Locality requested, this dealer doesn't serve it — fall back to distance
    // if we have it, else score low (won't clear the locality floor).
    return { score: distanceMiles != null ? distanceBucket(distanceMiles) : 0.15, distanceMiles };
  }

  if (distanceMiles != null) return { score: distanceBucket(distanceMiles), distanceMiles };

  // No place context at all — neutral so relevance/quality decide.
  return { score: 0.6, distanceMiles: null };
}

// --------------------------------------------------------------------------
// Quality — profile completeness, blended with the customer rating once
// there's enough of it to trust (a single 1-star or 5-star review must not
// swing a listing — brief §56, DEALER_RATING_MIN_FOR_RANKING).

export function computeQuality(d: RankableDealer): number {
  const completenessScore = Math.min(1, Math.max(0, d.completeness / 100));
  if (d.ratingAverage == null || d.ratingCount < DEALER_RATING_MIN_FOR_RANKING) {
    return completenessScore;
  }
  const ratingScore = Math.min(1, Math.max(0, (d.ratingAverage - 1) / 4)); // 1★→0, 5★→1
  return 0.5 * completenessScore + 0.5 * ratingScore;
}

// --------------------------------------------------------------------------
// Full ranking

export function rankDealers(dealers: RankableDealer[], q: ParsedQuery): DealerRankingResult {
  const scored: RankedDealer[] = [];

  for (const d of dealers) {
    // dealerType filter (applied by the service too, guarded here for direct callers).
    if (q.dealerType && q.dealerType !== d.dealerType) continue;
    const rel = computeRelevance(d, q);
    if (rel.score <= 0) continue; // never shown just for being nearby (brief §37)

    const loc = computeLocality(d, q);
    const quality = computeQuality(d);
    const availability = d.openNow == null ? 0.8 : d.openNow ? 1 : 0.6;
    // Wider than before (was 1 vs 0.85) — a genuine, bounded ranking boost for
    // FoodPadi Verified dealers, on top of the badge shown in the UI.
    const trust = d.isVerified ? 1 : 0.7;

    const organicScore =
      W.relevance * rel.score +
      W.locality * loc.score +
      W.quality * quality +
      W.availability * availability +
      W.trust * trust;

    scored.push({
      dealer: d,
      relevance: round2(rel.score),
      locality: round2(loc.score),
      organicScore: round2(organicScore),
      distanceMiles: loc.distanceMiles == null ? null : Math.round(loc.distanceMiles * 10) / 10,
      matchedTerms: rel.matched,
      isSponsored: false,
    });
  }

  scored.sort((a, b) => b.organicScore - a.organicScore);

  // Featured: subscription-eligible AND clears BOTH floors. Ordered by the same
  // organic score — the subscription is the eligibility gate, not a boost to the
  // number (brief §14/§45).
  const featured: RankedDealer[] = [];
  const organic: RankedDealer[] = [];
  for (const r of scored) {
    const eligible =
      r.dealer.featuredEligible &&
      r.relevance >= RELEVANCE_FLOOR &&
      r.locality >= LOCALITY_FLOOR &&
      featured.length < FEATURED_SLOTS;
    if (eligible) {
      featured.push({ ...r, isSponsored: true });
    } else {
      organic.push(r);
    }
  }

  return { featured, organic };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
