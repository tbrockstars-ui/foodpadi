import { BudgetTier, FoodIdea } from './eat-now-catalog';

// Illustrative distance/delivery-time/price estimates, explicitly requested
// as placeholder content to make results feel more complete — NOT real
// location, live pricing, or a real delivery ETA (no location capability or
// retailer integration exists — docs/IMPLEMENTATION_PLAN.md Phase 4). Every
// value here is deterministic per dish (a stable hash of its id), never
// randomised per-request, so the same search doesn't flicker between
// re-renders. EatNowScreen/EatNowSearchForm must keep these clearly labelled
// as estimates, not live data — see the "example suggestions" disclaimer.

export interface FoodIdeaEstimate {
  distanceMiles: number;
  deliveryMinutesMin: number;
  deliveryMinutesMax: number;
  pricePenceMin: number;
  pricePenceMax: number;
}

// Overall bounds per tier — an individual dish's band sits somewhere inside
// these, not the whole range, so two "medium" dishes don't show the exact
// same price band.
const PRICE_TIER_BOUNDS: Record<BudgetTier, [number, number]> = {
  low: [350, 750],
  medium: [750, 1350],
  high: [1350, 2400],
};
const PRICE_BAND_PENCE = 150;

function stableHash(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  }
  return hash;
}

export function estimateFor(idea: FoodIdea): FoodIdeaEstimate {
  // Separate hash seeds so distance and price vary independently instead of
  // moving in lockstep for every dish that shares an id "shape".
  const distanceHash = stableHash(idea.id);
  const priceHash = stableHash(`${idea.id}-price`);

  // Wide hash range (mod 250) then rounded down to 1 decimal for display —
  // keeps enough entropy that two dishes rarely land on the same value,
  // while still reading as "~1.8 mi", not implausibly precise.
  const distanceMiles = Math.round((0.3 + (distanceHash % 250) / 100) * 10) / 10; // 0.3–2.7 miles
  const deliveryMinutesMin = 15 + Math.round(distanceMiles * 6);

  const [tierMin, tierMax] = PRICE_TIER_BOUNDS[idea.budgetTier];
  const center = tierMin + (priceHash % (tierMax - tierMin));
  const pricePenceMin = Math.max(tierMin, Math.round((center - PRICE_BAND_PENCE) / 50) * 50);
  const pricePenceMax = Math.min(tierMax, Math.round((center + PRICE_BAND_PENCE) / 50) * 50);

  return {
    distanceMiles,
    deliveryMinutesMin,
    deliveryMinutesMax: deliveryMinutesMin + 10,
    pricePenceMin,
    pricePenceMax,
  };
}
