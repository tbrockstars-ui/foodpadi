import {
  computeLocality,
  computeQuality,
  computeRelevance,
  parseDealerQuery,
  rankDealers,
  type RankableDealer,
} from './dealer-ranking';
import { normaliseTerm } from './dealer-taxonomy';

function dealer(p: Partial<RankableDealer> & { id: string }): RankableDealer {
  const products = p.products ?? [];
  const categories = p.categories ?? [];
  const cuisines = p.cuisines ?? [];
  return {
    id: p.id,
    slug: p.slug ?? p.id,
    dealerType: p.dealerType ?? 'african_food_store',
    name: p.name ?? p.id,
    products,
    categories,
    cuisines,
    nameNorm: normaliseTerm(p.name ?? p.id),
    productsNorm: p.productsNorm ?? products.map(normaliseTerm),
    categoriesNorm: p.categoriesNorm ?? categories.map(normaliseTerm),
    cuisinesNorm: p.cuisinesNorm ?? cuisines.map(normaliseTerm),
    descriptionNorm: normaliseTerm(p.descriptionNorm ?? ''),
    localities: p.localities ?? ['leicester'],
    primaryLat: p.primaryLat ?? null,
    primaryLng: p.primaryLng ?? null,
    completeness: p.completeness ?? 85,
    featuredEligible: p.featuredEligible ?? false,
    isVerified: p.isVerified ?? false,
    openNow: p.openNow ?? null,
    ratingAverage: p.ratingAverage ?? null,
    ratingCount: p.ratingCount ?? 0,
  };
}

const q = (raw: string, opts?: Parameters<typeof parseDealerQuery>[1]) =>
  parseDealerQuery(raw, { knownLocalities: ['leicester', 'loughborough', 'nottingham'], ...opts });

describe('parseDealerQuery', () => {
  it('splits a trailing known locality off the query text', () => {
    const p = q('egusi leicester');
    expect(p.terms).toEqual(['egusi']);
    expect(p.locality).toBe('leicester');
  });

  it('splits a leading locality and a "near" filler', () => {
    expect(q('leicester nigerian groceries').locality).toBe('leicester');
    expect(q('egusi near leicester').terms).toEqual(['egusi']);
  });

  it('keeps the whole thing as terms when no locality is present', () => {
    const p = q('jollof rice');
    expect(p.terms).toEqual(expect.arrayContaining(['jollof', 'rice']));
    expect(p.locality).toBeNull();
  });

  it('an explicit locality option wins over free text', () => {
    expect(q('egusi', { locality: 'Nottingham' }).locality).toBe('nottingham');
  });
});

describe('computeRelevance', () => {
  const mamas = dealer({
    id: 'mamas',
    name: "Mama's African Foods",
    products: ['Egusi Soup', 'Jollof Rice', 'Palm Oil'],
    categories: ['African Food', 'Nigerian Food', 'Groceries'],
    cuisines: ['Nigerian'],
  });

  it('an exact product match scores top relevance', () => {
    expect(computeRelevance(mamas, q('egusi')).score).toBe(1);
    expect(computeRelevance(mamas, q('jollof rice leicester')).score).toBe(1);
  });

  it('a category / cuisine match scores mid relevance', () => {
    const r = computeRelevance(dealer({ id: 'x', categories: ['African Groceries'] }), q('african groceries'));
    expect(r.score).toBeCloseTo(0.7);
  });

  it('no genuine match → relevance 0 (dealer will be dropped, never shown for being nearby)', () => {
    const pizza = dealer({ id: 'pizza', name: 'Tony Pizza', products: ['Margherita', 'Pepperoni'], categories: ['Pizza'] });
    expect(computeRelevance(pizza, q('egusi leicester')).score).toBe(0);
  });

  it('a category filter the dealer does not carry knocks relevance to 0', () => {
    expect(computeRelevance(mamas, q('egusi', { category: 'Bakery' })).score).toBe(0);
  });

  it('an empty query is browse mode — neutral-positive relevance for every listing', () => {
    expect(computeRelevance(mamas, q('')).score).toBe(0.5);
  });
});

describe('computeLocality', () => {
  it('exact locality → 1.0', () => {
    expect(computeLocality(dealer({ id: 'a', localities: ['leicester'] }), q('egusi leicester')).score).toBe(1);
  });
  it('proximity buckets by distance when a lat/lng origin is given', () => {
    const near = dealer({ id: 'near', primaryLat: 52.63, primaryLng: -1.13, localities: [] });
    const far = dealer({ id: 'far', primaryLat: 52.95, primaryLng: -1.15, localities: [] });
    const parsed = q('egusi', { latitude: 52.6369, longitude: -1.1398 });
    expect(computeLocality(near, parsed).score).toBeGreaterThan(computeLocality(far, parsed).score);
  });
  it('a requested locality the dealer does not serve, with no origin → below the locality floor', () => {
    const p = computeLocality(dealer({ id: 'a', localities: ['nottingham'] }), q('egusi leicester'));
    expect(p.score).toBeLessThan(0.5);
  });
});

describe('computeQuality (post-visit ratings — user instruction 2026-09-11)', () => {
  it('with no ratings, quality is pure profile completeness', () => {
    const d = dealer({ id: 'a', completeness: 80, ratingAverage: null, ratingCount: 0 });
    expect(computeQuality(d)).toBeCloseTo(0.8);
  });

  it('a highly-rated dealer scores higher than a poorly-rated one at the same completeness', () => {
    const great = dealer({ id: 'great', completeness: 80, ratingAverage: 5, ratingCount: 10 });
    const poor = dealer({ id: 'poor', completeness: 80, ratingAverage: 1, ratingCount: 10 });
    expect(computeQuality(great)).toBeGreaterThan(computeQuality(poor));
  });

  it('too few ratings to trust → ignored, even if the average is terrible (one troll review cannot tank a listing)', () => {
    const thin = dealer({ id: 'thin', completeness: 80, ratingAverage: 1, ratingCount: 1 });
    expect(computeQuality(thin)).toBeCloseTo(0.8);
  });

  it('the rating blend is bounded — it can shift quality but never dominate it outright', () => {
    const perfectRating = dealer({ id: 'a', completeness: 0, ratingAverage: 5, ratingCount: 20 });
    // Even a flawless rating record with a 0%-complete profile is only half quality.
    expect(computeQuality(perfectRating)).toBeCloseTo(0.5);
  });
});

// ---------------------------------------------------------------------------
// The brief §81 CRITICAL ranking test + the user's "Network dealers first, but
// never a relevance override" instruction.
describe('rankDealers — the §81 critical test', () => {
  const A = dealer({
    id: 'A', // relevant + local + subscribed
    name: "Mama's African Foods",
    products: ['Egusi Soup', 'Pounded Yam'],
    categories: ['Nigerian Food'],
    localities: ['leicester'],
    featuredEligible: true,
    completeness: 90,
  });
  const B = dealer({
    id: 'B', // relevant + local + NOT subscribed
    name: 'African Taste Market',
    products: ['Egusi Soup', 'Plantain'],
    categories: ['African Food'],
    localities: ['leicester'],
    featuredEligible: false,
    completeness: 90,
  });
  const C = dealer({
    id: 'C', // irrelevant + local + subscribed
    name: 'Tony Pizza Leicester',
    products: ['Margherita', 'Pepperoni'],
    categories: ['Pizza'],
    localities: ['leicester'],
    featuredEligible: true,
    completeness: 95,
  });

  const result = rankDealers([A, B, C], q('egusi leicester'));

  it('A (relevant + paid) gets the Featured slot', () => {
    expect(result.featured.map((r) => r.dealer.id)).toEqual(['A']);
    expect(result.featured[0].isSponsored).toBe(true);
  });

  it('B (relevant, unpaid) is a strong organic result', () => {
    expect(result.organic.map((r) => r.dealer.id)).toContain('B');
    expect(result.organic.find((r) => r.dealer.id === 'B')!.relevance).toBe(1);
  });

  it('C (irrelevant, paid) is NOT Featured and does NOT appear above B', () => {
    expect(result.featured.map((r) => r.dealer.id)).not.toContain('C');
    const ids = result.organic.map((r) => r.dealer.id);
    // C has zero relevance for "egusi" → excluded entirely; if it were present
    // it must still be below B.
    if (ids.includes('C')) {
      expect(ids.indexOf('C')).toBeGreaterThan(ids.indexOf('B'));
    } else {
      expect(ids).toEqual(['B']);
    }
  });

  it('payment never promotes a below-floor match into Featured', () => {
    const descOnly = dealer({
      id: 'D',
      name: 'General Store',
      descriptionNorm: 'we sometimes stock egusi and other african items',
      categories: ['Convenience'],
      localities: ['leicester'],
      featuredEligible: true,
      completeness: 90,
    });
    const r = rankDealers([descOnly], q('egusi leicester'));
    expect(r.featured).toHaveLength(0); // relevance 0.3 < 0.5 floor
    expect(r.organic.map((x) => x.dealer.id)).toEqual(['D']);
  });

  it('at most 3 Featured slots', () => {
    const many = Array.from({ length: 6 }, (_, i) =>
      dealer({
        id: `F${i}`,
        products: ['Egusi Soup'],
        localities: ['leicester'],
        featuredEligible: true,
        completeness: 80 + i,
      }),
    );
    expect(rankDealers(many, q('egusi leicester')).featured.length).toBe(3);
  });
});

describe('rankDealers — ordering signals', () => {
  it('closer dealer outranks a far one when both are equally relevant', () => {
    const near = dealer({
      id: 'near',
      products: ['Egusi Soup'],
      localities: [],
      primaryLat: 52.635,
      primaryLng: -1.14,
    });
    const far = dealer({
      id: 'far',
      products: ['Egusi Soup'],
      localities: [],
      primaryLat: 52.95,
      primaryLng: -1.15,
    });
    const r = rankDealers([far, near], q('egusi', { latitude: 52.6369, longitude: -1.1398 }));
    expect(r.organic[0].dealer.id).toBe('near');
  });

  it('more complete profile breaks a tie', () => {
    const full = dealer({ id: 'full', products: ['Egusi Soup'], localities: ['leicester'], completeness: 100 });
    const thin = dealer({ id: 'thin', products: ['Egusi Soup'], localities: ['leicester'], completeness: 55 });
    const r = rankDealers([thin, full], q('egusi leicester'));
    expect(r.organic[0].dealer.id).toBe('full');
  });

  it('browse (empty query) returns every dealer, ranked by locality + quality', () => {
    const a = dealer({ id: 'a', localities: ['leicester'], completeness: 90 });
    const b = dealer({ id: 'b', localities: ['nottingham'], completeness: 90 });
    const r = rankDealers([a, b], q('', { locality: 'Leicester' }));
    expect(r.organic.map((x) => x.dealer.id)).toEqual(['a', 'b']);
  });

  it('a FoodPadi Verified dealer outranks an equally relevant, equally local unverified one (user instruction 2026-09-11)', () => {
    const verified = dealer({
      id: 'verified',
      products: ['Egusi Soup'],
      localities: ['leicester'],
      completeness: 80,
      isVerified: true,
    });
    const unverified = dealer({
      id: 'unverified',
      products: ['Egusi Soup'],
      localities: ['leicester'],
      completeness: 80,
      isVerified: false,
    });
    const r = rankDealers([unverified, verified], q('egusi leicester'));
    expect(r.organic.map((x) => x.dealer.id)).toEqual(['verified', 'unverified']);
  });

  it("but Verified is still just a tiebreaker — it can't outrank a genuinely more relevant/local unverified dealer", () => {
    const verifiedButFar = dealer({
      id: 'verifiedFar',
      products: ['Egusi Soup'],
      localities: ['nottingham'], // wrong locality — below the locality floor
      completeness: 95,
      isVerified: true,
    });
    const unverifiedLocal = dealer({
      id: 'unverifiedLocal',
      products: ['Egusi Soup'],
      localities: ['leicester'],
      completeness: 80,
      isVerified: false,
    });
    const r = rankDealers([verifiedButFar, unverifiedLocal], q('egusi leicester'));
    expect(r.organic[0].dealer.id).toBe('unverifiedLocal');
  });
});
