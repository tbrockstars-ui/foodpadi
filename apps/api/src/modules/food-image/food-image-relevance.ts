import type { ProviderPhoto } from './providers/food-image-provider';
import { normaliseFoodKey } from './food-image-query';

// Picking the best candidate for a dish, not just taking result #1 (brief §9,
// §11, §33). The provider query is already food-specific, so this is a
// re-rank + reject pass over the top handful it returned:
//
//  - hard-reject photos that clearly aren't an appetising plate of the dish
//    (too small/low-res, or an alt text about a person / a venue / a menu),
//  - score the rest by how many *distinctive* words of the dish name appear
//    in the alt text, preferring a landscape-ish crop that suits a card,
//  - if every candidate scores zero (provider gave no useful alt text), fall
//    back to the provider's own top surviving result rather than a placeholder
//    — the query was food-specific, so result #1 is still a reasonable dish shot.

const MIN_WIDTH = 500;

// Words that, in a photo's alt text, mean it's probably not the plated dish
// we want on a recommendation card.
const REJECT_TERMS = [
  'person', 'people', 'man ', 'woman', 'women', 'male', 'female', 'faceless',
  'child', 'kid', 'boy', 'girl', 'portrait', 'selfie', 'wearing', 'sitting on',
  'hand holding', 'chef ', 'waiter', 'waitress',
  'restaurant interior', 'dining room', 'storefront', 'shop front', 'signage',
  'menu', 'logo', 'text', 'blurred', 'blurry',
];

// Generic food words carry no discriminating signal — "chicken biryani" vs a
// photo captioned "a delicious meal on a plate" shouldn't score as a match.
const GENERIC_WORDS = new Set([
  'food', 'dish', 'meal', 'plate', 'bowl', 'lunch', 'dinner', 'breakfast',
  'delicious', 'tasty', 'fresh', 'homemade', 'cuisine', 'served',
  'traditional', 'healthy', 'closeup', 'close', 'up', 'view', 'table', 'wooden',
  'white', 'top', 'and', 'with', 'the',
]);

function distinctiveWords(foodName: string): string[] {
  return normaliseFoodKey(foodName)
    .split(' ')
    .filter((w) => w.length >= 3 && !GENERIC_WORDS.has(w));
}

function isRejected(photo: ProviderPhoto): boolean {
  if (photo.width > 0 && photo.width < MIN_WIDTH) return true;
  const desc = photo.description;
  if (!desc) return false;
  return REJECT_TERMS.some((term) => desc.includes(term));
}

function scorePhoto(photo: ProviderPhoto, keywords: string[]): number {
  let score = 0;

  const desc = photo.description;
  if (desc) {
    for (const word of keywords) {
      if (desc.includes(word)) score += 3;
    }
  }

  // Landscape / squarish crops sit better in a 4:3 card than a tall portrait.
  if (photo.width > 0 && photo.height > 0) {
    const ratio = photo.width / photo.height;
    if (ratio >= 1.1 && ratio <= 2.2) score += 1;
    else if (ratio < 0.9) score -= 1;
  }

  return score;
}

/**
 * @returns the chosen photo, or null if nothing survived the reject pass.
 */
export function pickBestPhoto(photos: ProviderPhoto[], foodName: string): ProviderPhoto | null {
  const survivors = photos.filter((p) => !isRejected(p));
  if (survivors.length === 0) return null;

  const keywords = distinctiveWords(foodName);
  let best = survivors[0]; // provider's own ranking is the tie-breaker / zero-signal fallback
  let bestScore = scorePhoto(best, keywords);

  for (const photo of survivors.slice(1)) {
    const score = scorePhoto(photo, keywords);
    if (score > bestScore) {
      best = photo;
      bestScore = score;
    }
  }

  return best;
}
