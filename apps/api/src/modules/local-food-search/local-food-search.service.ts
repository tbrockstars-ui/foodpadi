import { BadRequestException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import type { FoodMatchType, FoodProviderResult, LocalFoodSearchResponse } from '@foodpadi/shared';
import { AnalyticsService } from '../analytics/analytics.service';
import type { RequestActor } from '../auth/guest-or-auth.guard';
import { LocalFoodSearchDto } from './dto/local-food-search.dto';

// Identifies this app to OpenStreetMap's public services, as their usage
// policies require (Nominatim in particular will block requests with no —
// or a generic — User-Agent).
const USER_AGENT = 'FoodPadi/0.1 (https://foodpadi.app; local food discovery)';
const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';

// The free public Overpass instances rate-limit under bursty traffic (a real
// user hitting one during a shared spike, not just our own testing) — try
// each in order and fall through on a 429/5xx/timeout rather than failing the
// whole search because one mirror happened to be busy or slow.
const OVERPASS_URLS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.openstreetmap.ru/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
];

// Hard client-side ceilings on every outbound call. Without these a single
// slow/hung public mirror stalls the whole request for minutes and the user
// eventually sees a generic "couldn't find nearby food" error — the timeout
// turns that into a fast fall-through to the next mirror instead.
const OVERPASS_FETCH_TIMEOUT_MS = 10000;
const OVERPASS_RETRY_BACKOFF_MS = 1200;
const NOMINATIM_FETCH_TIMEOUT_MS = 6000;
// Overpass's own server-side budget — kept just under the fetch timeout so the
// server returns a partial/empty result rather than us aborting mid-response.
const OVERPASS_SERVER_TIMEOUT_S = 9;

// Start local (1 mile — a short walk, which is what "find it nearby" means),
// and only widen to 3 miles when the close pass genuinely matched nothing.
// Previously this was always three passes (1 -> 3 -> 5 mi), each able to hit
// three mirrors — up to nine round trips against flaky free infrastructure
// for one search, and the 5-mile pass in a dense city pulled thousands of
// elements, making the public mirrors far likelier to rate-limit or time out.
// A 1-mile query is typically ~2s vs ~14s for 3 miles.
const SEARCH_RADII_METRES = [1609, 4828]; // 1 mile, then 3 miles only if needed
const MAX_RESULTS = 5;

// Overpass responses are cached briefly, keyed by a coarse location grid so
// nearby searches (and, crucially, the UI's "Try again" button) reuse a
// result instead of hammering the mirrors again while they're struggling.
// ~2 decimal places of lat/lon ≈ a 1km cell — well inside the search radius.
const CACHE_TTL_MS = 10 * 60 * 1000;
const CACHE_MAX_ENTRIES = 200;

interface OverpassElement {
  id: number;
  type: string;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

interface OverpassResponse {
  elements: OverpassElement[];
}

// A curated map from common food requests to the OpenStreetMap tag values
// that count as real evidence of offering that food — deterministic, same
// spirit as eat-now-catalog.ts's keyword scoring, not a generative model.
//
//  - `keywords`      : phrases in the user's query that select this signal.
//  - `cuisineTags`   : OSM `cuisine=` values that are strong evidence -> EXACT_MATCH.
//  - `shopTags`      : OSM `shop=`   values that are strong evidence -> EXACT_MATCH.
//  - `looseCuisineTags`: broader/continent-level OSM `cuisine=` values that are
//                      only suggestive -> CLOSE_MATCH. Used where the dish name
//                      is unmistakable (e.g. "egusi", "jollof") so a place
//                      tagged only `cuisine=african` is still a fair "close"
//                      lead, without ever being promoted to an exact match.
interface FoodSignal {
  keywords: string[];
  cuisineTags: string[];
  shopTags?: string[];
  looseCuisineTags?: string[];
  label: string;
}

const FOOD_SIGNALS: FoodSignal[] = [
  {
    keywords: ['fish and chips', 'fish & chips', 'chip shop', 'chippy', 'fish supper'],
    cuisineTags: ['fish_and_chips'],
    shopTags: ['chip_shop'],
    label: 'Fish & chips',
  },
  { keywords: ['sushi', 'sashimi', 'maki'], cuisineTags: ['sushi', 'japanese'], label: 'Sushi' },
  { keywords: ['ramen', 'udon', 'katsu'], cuisineTags: ['ramen', 'japanese', 'noodle'], label: 'Japanese food' },
  { keywords: ['pizza', 'calzone'], cuisineTags: ['pizza', 'italian'], label: 'Pizza' },
  { keywords: ['pasta', 'italian', 'lasagne', 'lasagna', 'risotto'], cuisineTags: ['italian', 'pasta'], label: 'Italian food' },
  { keywords: ['kebab', 'doner', 'donner', 'shawarma', 'gyros'], cuisineTags: ['kebab', 'turkish'], label: 'Kebab' },
  { keywords: ['burger', 'cheeseburger', 'smashburger'], cuisineTags: ['burger'], label: 'Burger' },
  {
    keywords: ['peri peri', 'peri-peri', 'piri piri', 'nando', 'nandos', 'portuguese chicken', 'flame grilled chicken'],
    cuisineTags: ['portuguese', 'chicken'],
    looseCuisineTags: ['grill', 'barbecue'],
    label: 'Peri-peri chicken',
  },
  {
    keywords: ['fried chicken', 'chicken shop', 'wings', 'buffalo wings'],
    cuisineTags: ['chicken', 'fried_chicken'],
    label: 'Fried chicken',
  },
  {
    keywords: ['chicken biryani', 'biryani', 'biriyani', 'briyani'],
    cuisineTags: ['indian', 'biryani', 'pakistani', 'bangladeshi'],
    label: 'Biryani',
  },
  // West African dishes. The OSM tagging in the UK is inconsistent —
  // `cuisine=nigerian`, `west_african`, `ghanaian`, sometimes just `african`
  // (continent-level, so only a loose/close lead, never exact) — so match
  // across all of them rather than a single canonical tag.
  {
    keywords: [
      'jollof', 'jollof rice', 'egusi', 'egusi soup', 'efo riro', 'efo',
      'pounded yam', 'fufu', 'eba', 'amala', 'garri', 'ogbono', 'okra soup',
      'okro soup', 'ewedu', 'banga soup', 'pepper soup', 'suya', 'asun',
      'moin moin', 'moi moi', 'akara', 'puff puff', 'nkwobi', 'ofada',
      'nigerian', 'ghanaian', 'west african', 'african food',
    ],
    cuisineTags: ['nigerian', 'west_african', 'ghanaian', 'senegalese'],
    looseCuisineTags: ['african'], // continent-level tag — a close lead only, never exact
    label: 'West African food',
  },
  {
    keywords: ['jerk chicken', 'jerk', 'curry goat', 'ackee', 'saltfish', 'plantain', 'caribbean', 'jamaican', 'roti'],
    cuisineTags: ['caribbean', 'jamaican'],
    label: 'Caribbean food',
  },
  {
    keywords: ['injera', 'doro wat', 'ethiopian', 'eritrean', 'tibs'],
    cuisineTags: ['ethiopian', 'eritrean'],
    label: 'Ethiopian food',
  },
  { keywords: ['chinese', 'dim sum', 'dumpling', 'dumplings', 'chow mein', 'wonton'], cuisineTags: ['chinese', 'cantonese'], label: 'Chinese food' },
  { keywords: ['pho', 'banh mi', 'vietnamese'], cuisineTags: ['vietnamese'], label: 'Vietnamese food' },
  { keywords: ['pad thai', 'thai', 'green curry', 'tom yum'], cuisineTags: ['thai'], label: 'Thai food' },
  { keywords: ['indian', 'curry', 'tikka', 'masala', 'balti', 'dosa', 'naan'], cuisineTags: ['indian', 'pakistani', 'bangladeshi'], label: 'Indian food' },
  { keywords: ['korean', 'bibimbap', 'bulgogi', 'kimchi'], cuisineTags: ['korean'], label: 'Korean food' },
  { keywords: ['mexican', 'burrito', 'taco', 'tacos', 'quesadilla', 'nachos'], cuisineTags: ['mexican', 'tex-mex'], label: 'Mexican food' },
  { keywords: ['falafel', 'hummus', 'shakshuka', 'lebanese', 'mezze', 'middle eastern'], cuisineTags: ['lebanese', 'arab', 'middle_eastern'], label: 'Middle Eastern food' },
  { keywords: ['tapas', 'paella', 'spanish'], cuisineTags: ['spanish', 'tapas'], label: 'Spanish food' },
  { keywords: ['sunday roast', 'roast dinner', 'pie and mash', 'full english', 'fry up'], cuisineTags: ['british', 'english'], label: 'British food' },
  { keywords: ['coffee', 'espresso', 'flat white', 'cappuccino', 'latte'], cuisineTags: ['coffee_shop', 'coffee'], shopTags: ['coffee'], label: 'Coffee' },
  { keywords: ['ice cream', 'gelato'], cuisineTags: ['ice_cream'], label: 'Ice cream' },
  { keywords: ['breakfast', 'brunch', 'pancakes'], cuisineTags: ['breakfast', 'brunch'], label: 'Breakfast' },
  { keywords: ['sandwich', 'sandwiches', 'sub', 'baguette'], cuisineTags: ['sandwich'], shopTags: ['deli', 'sandwich'], label: 'Sandwiches' },
];

// Filler words plus generic food/service words that are meaningless as
// standalone evidence: "soup" or "chicken" appearing in a business name or a
// broad cuisine tag says nothing about whether it serves the *specific* thing
// asked for. Query phrases containing these still match via FOOD_SIGNALS
// (which key on the whole phrase, e.g. "egusi soup"); only the last-resort
// generic token pass drops them.
const STOPWORDS = new Set([
  'a', 'an', 'the', 'some', 'any', 'i', 'want', 'for', 'me', 'of', 'and', 'with', 'near', 'nearby', 'get',
  'food', 'meal', 'dish', 'lunch', 'dinner', 'takeaway', 'takeout', 'restaurant', 'place', 'cafe',
  'soup', 'stew', 'rice', 'sauce', 'fried', 'grilled', 'roast', 'roasted', 'hot', 'spicy', 'fresh', 'best',
]);

function meaningfulTokens(query: string): string[] {
  return query
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 2 && !STOPWORDS.has(word));
}

export function resolveSignal(query: string): FoodSignal | undefined {
  const q = query.toLowerCase();
  return FOOD_SIGNALS.find((signal) => signal.keywords.some((keyword) => q.includes(keyword)));
}

function titleCase(value: string): string {
  return value.replace(/\b\w/g, (c) => c.toUpperCase());
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// A signal keyword appears as a *whole word* in the business name — "suya" in
// "Presidential Suya", but NOT "garri" (cassava flour) inside "Le Garrick"
// (a French restaurant). Bare substring matching produced exactly that kind
// of confident nonsense.
function nameContainsKeyword(nameLower: string, keyword: string): boolean {
  return new RegExp(`\\b${escapeRegExp(keyword)}\\b`).test(nameLower);
}

/**
 * Decide whether a single venue is real evidence of the requested food, based
 * only on its own OSM tags. Pure and exported for unit testing — the ranking,
 * distance maths and network fetch live in the service around it.
 *
 *  - EXACT_MATCH: the venue's structured `cuisine`/`shop` tag is exactly one
 *    the resolved food signal treats as strong evidence.
 *  - CLOSE_MATCH: a broader/continent-level cuisine tag, a distinctive dish
 *    word in the business *name*, or (last resort) a raw query token found in
 *    the `cuisine` tag. Query tokens are never matched against the name —
 *    "soup" is a substring of "Ducksoup".
 *  - null: no evidence at all; the venue is dropped, never shown "just" for
 *    being nearby.
 */
export function classifyVenue(
  tags: Record<string, string>,
  requestedFood: string,
  queryTokens: string[],
  matchedSignal: FoodSignal | undefined,
): { matchType: FoodMatchType; matchedFood: string } | null {
  const cuisineValues = (tags.cuisine ?? '')
    .toLowerCase()
    .split(/[;,]/)
    .map((c) => c.trim().replace(/\s+/g, '_'))
    .filter(Boolean);
  const shopValue = (tags.shop ?? '').toLowerCase();
  const nameLower = (tags.name ?? '').toLowerCase();

  if (matchedSignal) {
    const exactCuisineHit = cuisineValues.some((c) => matchedSignal.cuisineTags.includes(c));
    const shopHit = matchedSignal.shopTags?.includes(shopValue) ?? false;
    if (exactCuisineHit || shopHit) {
      return { matchType: 'EXACT_MATCH', matchedFood: matchedSignal.label };
    }

    const looseCuisineHit = (matchedSignal.looseCuisineTags ?? []).some((c) => cuisineValues.includes(c));
    // A distinctive dish word as a whole word in the business name
    // ("Presidential Suya", "Jollof House") — decent evidence, but softer than
    // a structured cuisine tag, so only ever a close match. Keywords 4+ chars
    // so short filler ("pie", "sub") can't trigger it.
    const nameKeywordHit = matchedSignal.keywords.some(
      (kw) => kw.length >= 4 && nameContainsKeyword(nameLower, kw),
    );
    if (looseCuisineHit || nameKeywordHit) {
      return { matchType: 'CLOSE_MATCH', matchedFood: matchedSignal.label };
    }
  }

  if (queryTokens.length > 0) {
    const tokenHit = queryTokens.find((token) =>
      cuisineValues.some((c) => c === token || c.includes(token) || token.includes(c)),
    );
    if (tokenHit) {
      const hitCuisine = cuisineValues.find((c) => c.includes(tokenHit) || tokenHit.includes(c));
      return {
        matchType: 'CLOSE_MATCH',
        matchedFood: hitCuisine ? titleCase(hitCuisine.replace(/_/g, ' ')) : requestedFood,
      };
    }
  }

  return null;
}

// Haversine distance in miles — real, computed from the two real coordinates
// (the search origin and the venue's own OSM coordinates), never guessed or
// asserted by a model.
function distanceMiles(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3958.8;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

function actorToAnalyticsFields(actor: RequestActor) {
  return actor.type === 'user' ? { userId: actor.userId } : { guestSessionId: actor.sessionId };
}

@Injectable()
export class LocalFoodSearchService {
  private readonly logger = new Logger(LocalFoodSearchService.name);
  private readonly venueCache = new Map<string, { at: number; elements: OverpassElement[] }>();

  constructor(private readonly analytics: AnalyticsService) {}

  async search(dto: LocalFoodSearchDto, actor: RequestActor): Promise<LocalFoodSearchResponse> {
    const hasCoordinates = typeof dto.latitude === 'number' && typeof dto.longitude === 'number';
    if (!hasCoordinates && !dto.locationText?.trim()) {
      throw new BadRequestException('Provide either coordinates or a location to search near.');
    }

    const origin = hasCoordinates
      ? { latitude: dto.latitude!, longitude: dto.longitude! }
      : await this.geocode(dto.locationText!.trim());

    const queryTokens = meaningfulTokens(dto.query);
    const matchedSignal = resolveSignal(dto.query);

    let results: FoodProviderResult[] = [];
    let usedRadius = SEARCH_RADII_METRES[0];
    for (const radiusMetres of SEARCH_RADII_METRES) {
      usedRadius = radiusMetres;
      const elements = await this.getNearbyVenues(origin, radiusMetres);
      results = this.matchAndRank(elements, origin, dto.query, queryTokens, matchedSignal);
      if (results.length > 0) break; // widen only when the closer pass found nothing
    }

    await this.analytics.track('local_food_search_performed', actorToAnalyticsFields(actor), {
      resultCount: results.length,
      radiusMetres: usedRadius,
    });

    return {
      query: dto.query,
      results,
      source: results.length > 0 ? 'openstreetmap' : null,
    };
  }

  private async geocode(locationText: string): Promise<{ latitude: number; longitude: number }> {
    const url = new URL(NOMINATIM_URL);
    url.searchParams.set('q', locationText);
    url.searchParams.set('format', 'json');
    url.searchParams.set('limit', '1');
    url.searchParams.set('countrycodes', 'gb');

    let response: Response;
    try {
      response = await fetch(url.toString(), {
        headers: { 'User-Agent': USER_AGENT },
        signal: AbortSignal.timeout(NOMINATIM_FETCH_TIMEOUT_MS),
      });
    } catch (e) {
      this.logger.error(`Nominatim geocoding failed: ${e instanceof Error ? e.message : String(e)}`);
      throw new ServiceUnavailableException("We couldn't look up that location right now. Please try again.");
    }
    if (!response.ok) {
      throw new ServiceUnavailableException("We couldn't look up that location right now. Please try again.");
    }

    const results = (await response.json()) as Array<{ lat: string; lon: string }>;
    if (results.length === 0) {
      throw new BadRequestException("We couldn't find that location. Try a postcode or a town name.");
    }
    return { latitude: parseFloat(results[0].lat), longitude: parseFloat(results[0].lon) };
  }

  // Fetch (or reuse a recent) set of nearby food venues for this location.
  // The cache key is a coarse grid cell, so a user who taps "Try again", or
  // a second user searching the same neighbourhood minutes later, gets an
  // instant answer even while the public Overpass mirrors are throttling.
  private async getNearbyVenues(
    origin: { latitude: number; longitude: number },
    radiusMetres: number,
  ): Promise<OverpassElement[]> {
    const key = `${radiusMetres}:${origin.latitude.toFixed(2)},${origin.longitude.toFixed(2)}`;
    const cached = this.venueCache.get(key);
    if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
      return cached.elements;
    }

    let elements: OverpassElement[];
    try {
      elements = await this.queryOverpass(origin, radiusMetres);
    } catch (e) {
      // Every live mirror failed. If we have a stale-but-usable result for
      // this cell, a slightly old list beats a dead end — serve it rather
      // than error out.
      if (cached) {
        this.logger.warn('Overpass unavailable — serving stale cached venues for this area.');
        return cached.elements;
      }
      throw e;
    }

    if (this.venueCache.size >= CACHE_MAX_ENTRIES) {
      // Cheap bound: drop the oldest-inserted entry (Map preserves insertion order).
      const oldest = this.venueCache.keys().next().value;
      if (oldest !== undefined) this.venueCache.delete(oldest);
    }
    this.venueCache.set(key, { at: Date.now(), elements });
    return elements;
  }

  private async queryOverpass(
    origin: { latitude: number; longitude: number },
    radiusMetres: number,
  ): Promise<OverpassElement[]> {
    const around = `around:${radiusMetres},${origin.latitude},${origin.longitude}`;
    // `nwr` = node + way + relation: a large share of UK restaurants and
    // takeaways are mapped as building outlines (ways), not points, so a
    // node-only query silently drops them. `out center` gives each way/
    // relation a single representative coordinate for the distance maths.
    // No `out` count cap: Overpass's count limit truncates in element-id
    // order, not by distance, so a cap can silently drop the closest match.
    // The search radius is what bounds the response size instead.
    const query = `
      [out:json][timeout:${OVERPASS_SERVER_TIMEOUT_S}];
      (
        nwr["amenity"~"^(restaurant|fast_food|cafe|pub|bar|food_court)$"](${around});
        nwr["shop"~"^(chip_shop|bakery|deli|coffee|sandwich)$"](${around});
      );
      out center tags;
    `.trim();

    // Attempt order: each mirror once, plus one extra shot at the primary
    // (best-maintained) instance after a short backoff — its 429s are usually
    // a brief per-IP burst limit that clears within a second or two.
    const attempts = [...OVERPASS_URLS, OVERPASS_URLS[0]];

    let lastError = '';
    for (const [i, url] of attempts.entries()) {
      const isLastAttempt = i === attempts.length - 1;
      const isPrimaryRetry = i === attempts.length - 1 && url === OVERPASS_URLS[0];
      if (isPrimaryRetry) await new Promise((r) => setTimeout(r, OVERPASS_RETRY_BACKOFF_MS));

      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain', 'User-Agent': USER_AGENT },
          body: query,
          signal: AbortSignal.timeout(OVERPASS_FETCH_TIMEOUT_MS),
        });
        if (!response.ok) {
          lastError = `HTTP ${response.status}`;
          this.logger.warn(`Overpass mirror ${url} returned ${response.status}`);
          if (isLastAttempt) break;
          continue; // rate-limited (429) or briefly down — try the next mirror
        }
        const data = (await response.json()) as OverpassResponse;
        return data.elements ?? [];
      } catch (e) {
        lastError = e instanceof Error ? e.message : String(e);
        this.logger.warn(`Overpass mirror ${url} failed: ${lastError}`);
        if (isLastAttempt) break;
        continue; // timeout, connection error, aborted, or unparseable body
      }
    }

    this.logger.error(`All Overpass attempts failed. Last error: ${lastError}`);
    throw new ServiceUnavailableException("We couldn't reach the local food data source right now. Please try again in a moment.");
  }

  // A business is only ever included if its own OSM tags provide real
  // evidence of the requested food — never included just for being nearby,
  // and address/phone/website are only ever populated from real tags on
  // that same element, never guessed or constructed.
  private matchAndRank(
    elements: OverpassElement[],
    origin: { latitude: number; longitude: number },
    requestedFood: string,
    queryTokens: string[],
    matchedSignal: FoodSignal | undefined,
  ): FoodProviderResult[] {
    const results: FoodProviderResult[] = [];

    for (const el of elements) {
      const tags = el.tags ?? {};
      const name = tags.name;
      if (!name) continue; // never show an unnamed business

      const lat = el.lat ?? el.center?.lat;
      const lon = el.lon ?? el.center?.lon;
      if (typeof lat !== 'number' || typeof lon !== 'number') continue;

      const classification = classifyVenue(tags, requestedFood, queryTokens, matchedSignal);
      if (!classification) continue; // no real evidence at all — never shown

      const miles = distanceMiles(origin.latitude, origin.longitude, lat, lon);
      const address = this.buildAddress(tags);

      results.push({
        id: `${el.type}-${el.id}`,
        name,
        address,
        phone: tags.phone || tags['contact:phone'] || null,
        websiteUrl: this.nullIfNotHttpUrl(tags.website || tags['contact:website']),
        orderUrl: null, // OSM has no reliable ordering-URL concept — never guessed
        bookingUrl: null, // same — no reliable reservation-URL concept in OSM tags
        mapsUrl: `https://www.openstreetmap.org/${el.type}/${el.id}`,
        distanceText: miles < 0.1 ? 'under 0.1 mi away' : `${miles.toFixed(1)} mi away`,
        requestedFood,
        matchedFood: classification.matchedFood,
        matchType: classification.matchType,
      });
    }

    results.sort((a, b) => {
      if (a.matchType !== b.matchType) return a.matchType === 'EXACT_MATCH' ? -1 : 1;
      return this.milesFromText(a.distanceText) - this.milesFromText(b.distanceText);
    });

    return results.slice(0, MAX_RESULTS);
  }

  private milesFromText(distanceText: string | null): number {
    if (!distanceText) return 999;
    if (distanceText.startsWith('under')) return 0;
    return parseFloat(distanceText) || 999;
  }

  private buildAddress(tags: Record<string, string>): string | null {
    const parts = [tags['addr:housenumber'], tags['addr:street'], tags['addr:city'] || tags['addr:town']].filter(
      Boolean,
    );
    return parts.length > 0 ? parts.join(' ') : null;
  }

  private nullIfNotHttpUrl(value: string | undefined): string | null {
    if (!value) return null;
    try {
      const url = new URL(value);
      return url.protocol === 'http:' || url.protocol === 'https:' ? value : null;
    } catch {
      return null;
    }
  }
}
