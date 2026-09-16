// Deterministic taxonomy + text-normalisation helpers for the Food Dealer
// Network. Pure functions only — no I/O, no AI (dealer brief §57: the search
// engine must stay deterministic and cost-efficient). Shared by the portal
// service (validation + search-profile denormalisation) and the search engine.

import { DEALER_TYPES, type DealerType } from '@foodpadi/shared';

export function isDealerType(value: unknown): value is DealerType {
  return typeof value === 'string' && (DEALER_TYPES as readonly string[]).includes(value);
}

// Lowercase, strip accents + punctuation, collapse whitespace. The one
// normalisation every stored term and every query token passes through so
// "Egúsi Soup!" and "egusi soup" compare equal (brief §36).
export function normaliseTerm(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '') // strip combining diacritical marks left by NFKD
    .toLowerCase()
    .replace(/['’ʼ`]/g, '') // drop apostrophes so "Mama's" → "mamas", not "mama s"
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/[\s-]+/g, ' ')
    .trim();
}

// Split a free-text string into meaningful tokens (2+ chars, stopwords
// removed). Mirrors local-food-search's `meaningfulTokens` intent so the two
// discovery engines treat a query the same way.
const STOPWORDS = new Set([
  'a', 'an', 'the', 'some', 'any', 'i', 'want', 'for', 'me', 'of', 'and', 'with',
  'near', 'nearby', 'get', 'buy', 'find', 'where', 'can', 'to', 'my', 'in', 'at',
  'food', 'foods', 'meal', 'dish', 'shop', 'store', 'dealer', 'business', 'best',
]);

export function tokenise(value: string): string[] {
  return normaliseTerm(value)
    .split(' ')
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

// A compact singular/plural + common-variant folder so "groceries" matches
// "grocery" and "tomatoes" matches "tomato". Deliberately tiny and rule-based,
// not a stemmer library (brief §36: "do not build an unnecessarily complex NLP
// engine for MVP").
export function singularise(token: string): string {
  if (token.length <= 3) return token;
  if (token.endsWith('ies')) return `${token.slice(0, -3)}y`;
  if (token.endsWith('ses') || token.endsWith('xes') || token.endsWith('zes')) return token.slice(0, -2);
  if (token.endsWith('oes')) return token.slice(0, -2);
  if (token.endsWith('s') && !token.endsWith('ss')) return token.slice(0, -1);
  return token;
}

export function normaliseTerms(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of values) {
    const n = normaliseTerm(raw);
    if (n && !seen.has(n)) {
      seen.add(n);
      out.push(n);
    }
  }
  return out;
}

// Kebab-case slug base from a business name. The portal service appends the
// primary locality on a uniqueness collision.
export function slugifyName(name: string): string {
  return normaliseTerm(name).replace(/ /g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'dealer';
}

// Sanity ceilings applied when a dealer's search profile is (re)built, so a
// listing can't be stuffed with hundreds of keywords (brief §56).
export const DEALER_LIMITS = {
  categories: 20,
  cuisines: 20,
  productKeywords: 60,
  products: 60,
  locations: 25,
  serviceAreasPerLocation: 30,
} as const;
