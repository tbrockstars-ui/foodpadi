// Central image/asset registry (Step 30 of the visual-redesign brief) — every
// externally-sourced image used anywhere in the app is recorded here once,
// with its source, license and intended use, rather than scattered as raw
// URLs through components. All current entries are Pexels photos (Pexels
// License: free for commercial + personal use, no attribution required —
// https://www.pexels.com/license/), fetched via their documented CDN resize
// params (?auto=compress&cs=tinysrgb&w=N) so the page never ships a
// full-resolution original. Swap `url` for a locally-hosted/owned asset
// later without touching call sites — everything reads through this file.

export interface ImageAsset {
  name: string;
  url: string;
  source: 'pexels';
  sourceUrl: string;
  photographer: string;
  license: string;
  component: string;
  alt: string;
}

function pexels(id: number, width: number): string {
  return `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=${width}`;
}

export const IMAGE_ASSETS = {
  decideHero: {
    name: 'Overhead spread of sushi and poké bowls',
    url: pexels(4703909, 500),
    source: 'pexels',
    sourceUrl: 'https://www.pexels.com/photo/overhead-shot-a-variety-of-food-on-a-table-4703909/',
    photographer: 'Irina Edilbaeva',
    license: 'Pexels License — free for commercial use, no attribution required',
    component: 'DecideFlow hero visual',
    alt: 'Overhead view of a colourful spread of food on a table',
  },
  // (The "Right now" IntentCard was removed from Home — DecideFlow covers that
  // intent — so its image asset is gone too.)
  cooking: {
    name: 'Slicing fresh peppers in the kitchen',
    // w=800 (2x the default) — same reasoning as planAhead: this card goes
    // near full-width on phones and a 400px source looked soft there.
    url: pexels(8629042, 800),
    source: 'pexels',
    sourceUrl: 'https://www.pexels.com/photo/a-person-slicing-peppers-8629042/',
    photographer: 'Kampus Production',
    license: 'Pexels License — free for commercial use, no attribution required',
    component: 'IntentCard — Cooking',
    alt: 'Hands slicing a fresh red pepper on a chopping board in a kitchen',
  },
  planAhead: {
    name: 'A week of colourful meal-prep boxes',
    // w=800 (2x the other IntentCard photos): this card renders near
    // full-width on phones, where a 400px source looked visibly soft.
    url: pexels(1640771, 800),
    source: 'pexels',
    sourceUrl: 'https://www.pexels.com/photo/variety-of-dishes-1640771/',
    photographer: 'Ella Olsson',
    license: 'Pexels License — free for commercial use, no attribution required',
    component: 'IntentCard — Plan ahead',
    alt: 'Four meal-prep boxes of falafel, chickpeas, rice and fresh vegetables laid out for the week',
  },
} as const satisfies Record<string, ImageAsset>;

// One real photo per cuisine (not per dish — recipe titles are AI-generated/
// curated-fallback, so there's no specific photo of e.g. "One-Pot Chicken &
// Rice" to source; a cuisine-level photo is the same honesty trade-off
// IntentCard already makes above). Keyed by RecipeView.cuisine, lowercased.
// PLAN_CUISINE_FALLBACK covers any cuisine not in this map (Chinese, Thai,
// French, Caribbean, Middle Eastern, American, null, ...) rather than
// growing this list without bound.
export const PLAN_CUISINE_IMAGES = {
  british: {
    name: 'Roast dinner with vegetables',
    url: pexels(34991330, 400),
    source: 'pexels',
    sourceUrl: 'https://www.pexels.com/photo/delicious-roast-dinner-with-vegetables-34991330/',
    photographer: 'Luca Volpe Productions',
    license: 'Pexels License — free for commercial use, no attribution required',
    component: 'PlanView / PlanAheadScreen — cuisine image (British)',
    alt: 'Roast dinner with meat, potatoes and vegetables',
  },
  italian: {
    name: 'Spaghetti carbonara',
    url: pexels(546945, 400),
    source: 'pexels',
    sourceUrl: 'https://www.pexels.com/photo/close-up-of-spaghetti-carbonara-546945/',
    photographer: 'Maurijn Pach',
    license: 'Pexels License — free for commercial use, no attribution required',
    component: 'PlanView / PlanAheadScreen — cuisine image (Italian)',
    alt: 'Close-up of spaghetti carbonara topped with parmesan',
  },
  indian: {
    name: 'Indian curry',
    url: pexels(33643313, 400),
    source: 'pexels',
    sourceUrl: 'https://www.pexels.com/photo/authentic-indian-dum-aloo-curry-in-traditional-bowl-33643313/',
    photographer: 'Pinaki Panda',
    license: 'Pexels License — free for commercial use, no attribution required',
    component: 'PlanView / PlanAheadScreen — cuisine image (Indian)',
    alt: 'Indian curry served in a traditional bowl',
  },
  mediterranean: {
    name: 'Mediterranean spread',
    url: pexels(5083910, 400),
    source: 'pexels',
    sourceUrl: 'https://www.pexels.com/photo/a-delicious-foods-on-a-wooden-table-5083910/',
    photographer: 'Jep Gambardella',
    license: 'Pexels License — free for commercial use, no attribution required',
    component: 'PlanView / PlanAheadScreen — cuisine image (Mediterranean)',
    alt: 'Mediterranean dishes including salads and hummus, shot from above',
  },
  mexican: {
    name: 'Mexican tacos',
    url: pexels(18574186, 400),
    source: 'pexels',
    sourceUrl: 'https://www.pexels.com/photo/tacos-are-served-on-paper-plates-with-lime-and-onions-18574186/',
    photographer: 'Julias Torten und Törtchen',
    license: 'Pexels License — free for commercial use, no attribution required',
    component: 'PlanView / PlanAheadScreen — cuisine image (Mexican)',
    alt: 'Mexican tacos topped with onion, cilantro and lime',
  },
  japanese: {
    name: 'Sushi rolls',
    url: pexels(19957865, 400),
    source: 'pexels',
    sourceUrl: 'https://www.pexels.com/photo/close-up-of-food-19957865/',
    photographer: 'Katana',
    license: 'Pexels License — free for commercial use, no attribution required',
    component: 'PlanView / PlanAheadScreen — cuisine image (Japanese)',
    alt: 'Sushi rolls topped with sesame seeds',
  },
} as const satisfies Record<string, ImageAsset>;

export const PLAN_CUISINE_FALLBACK: ImageAsset = {
  name: 'Home-cooked meal spread',
  url: pexels(37823049, 400),
  source: 'pexels',
  sourceUrl: 'https://www.pexels.com/photo/delicious-rice-and-soup-meal-on-elegant-table-37823049/',
  photographer: 'İdil Ceren Çelikler',
  license: 'Pexels License — free for commercial use, no attribution required',
  component: 'PlanView / PlanAheadScreen — cuisine image (fallback)',
  alt: 'A home-cooked meal of rice, soup and vegetables',
};

/** Case-insensitive lookup with a generic fallback for any cuisine not curated above. */
export function getCuisineImage(cuisine: string | null): ImageAsset {
  if (!cuisine) return PLAN_CUISINE_FALLBACK;
  const key = cuisine.trim().toLowerCase() as keyof typeof PLAN_CUISINE_IMAGES;
  return PLAN_CUISINE_IMAGES[key] ?? PLAN_CUISINE_FALLBACK;
}
