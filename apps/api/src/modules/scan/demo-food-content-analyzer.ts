import { RawFoodContentResult } from '../ai/claude.service';

// Deterministic demo dishes for validating the "what's in this dish?" Scan
// mode without an ANTHROPIC_API_KEY or any AI spend (SCAN_DEMO_MODE=true) —
// same rationale and technique as demo-scan-analyzer.ts's pantry-scan
// scenarios, just a different content shape (one dish + its ingredients,
// not a list of separate pantry items).

interface DemoDish {
  dishName: string;
  ingredients: { name: string; note: string | null }[];
}

const DEMO_DISHES: DemoDish[] = [
  {
    dishName: 'Jollof rice with chicken',
    ingredients: [
      { name: 'Rice', note: null },
      { name: 'Chicken', note: null },
      { name: 'Tomato', note: null },
      { name: 'Red pepper', note: null },
      { name: 'Onion', note: null },
      { name: 'Vegetable oil', note: 'commonly used, not directly visible' },
      { name: 'Stock cube', note: 'commonly used, not directly visible' },
      { name: 'Chilli', note: 'commonly used, not directly visible' },
    ],
  },
  {
    dishName: 'Spaghetti bolognese',
    ingredients: [
      { name: 'Spaghetti', note: null },
      { name: 'Minced beef', note: null },
      { name: 'Tomato sauce', note: null },
      { name: 'Onion', note: 'commonly used, not directly visible' },
      { name: 'Garlic', note: 'commonly used, not directly visible' },
      { name: 'Parmesan', note: null },
      { name: 'Olive oil', note: 'commonly used, not directly visible' },
    ],
  },
  {
    dishName: 'Chicken shawarma wrap',
    ingredients: [
      { name: 'Flatbread', note: null },
      { name: 'Chicken', note: null },
      { name: 'Lettuce', note: null },
      { name: 'Tomato', note: null },
      { name: 'Garlic sauce', note: null },
      { name: 'Shawarma spice mix', note: 'commonly used, not directly visible' },
    ],
  },
  {
    dishName: 'Fish and chips',
    ingredients: [
      { name: 'White fish', note: null },
      { name: 'Batter', note: null },
      { name: 'Potato chips', note: null },
      { name: 'Vegetable oil', note: 'commonly used, not directly visible' },
      { name: 'Salt', note: 'commonly used, not directly visible' },
      { name: 'Malt vinegar', note: null },
    ],
  },
];

/**
 * Deterministically picks a demo dish from an uploaded photo's own bytes —
 * same technique as demo-scan-analyzer.ts's demoScenarioForPhoto (a stable
 * hash, not a random pick), so the same photo always yields the same result.
 */
export function demoFoodContentForPhoto(imageBase64: string): RawFoodContentResult {
  let hash = 0;
  const sampleLength = Math.min(imageBase64.length, 2000);
  for (let i = 0; i < sampleLength; i++) {
    hash = (hash * 31 + imageBase64.charCodeAt(i)) >>> 0;
  }
  const dish = DEMO_DISHES[hash % DEMO_DISHES.length];
  return dish;
}
