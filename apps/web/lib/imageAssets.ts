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
  rightNow: {
    name: 'Plated grilled meal',
    url: pexels(1707917, 400),
    source: 'pexels',
    sourceUrl: 'https://www.pexels.com/photo/plated-grilled-meal-1707917/',
    photographer: 'Melanie Dompierre',
    license: 'Pexels License — free for commercial use, no attribution required',
    component: 'IntentCard — Right now',
    alt: 'A ready-to-eat grilled meal, plated',
  },
  cooking: {
    name: 'Sliced vegetables on a chopping board',
    url: pexels(3872439, 400),
    source: 'pexels',
    sourceUrl: 'https://www.pexels.com/photo/photo-of-sliced-vegetables-on-wooden-chopping-board-3872439/',
    photographer: 'Polina Tankilevitch',
    license: 'Pexels License — free for commercial use, no attribution required',
    component: 'IntentCard — Cooking',
    alt: 'Fresh sliced vegetables on a wooden chopping board',
  },
  planAhead: {
    name: 'Weekly meal-prep containers',
    url: pexels(30635720, 400),
    source: 'pexels',
    sourceUrl: 'https://www.pexels.com/photo/healthy-meal-prep-containers-with-rice-and-vegetables-30635720/',
    photographer: 'Iara Melo',
    license: 'Pexels License — free for commercial use, no attribution required',
    component: 'IntentCard — Plan ahead',
    alt: 'Rice and vegetables portioned into meal-prep containers',
  },
} as const satisfies Record<string, ImageAsset>;
