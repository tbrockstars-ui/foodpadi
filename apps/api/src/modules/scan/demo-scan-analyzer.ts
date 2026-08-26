import { RawScannedItem } from '../ai/claude.service';

// Deterministic demo scenarios for validating Scan's UX without an
// ANTHROPIC_API_KEY or any AI spend (SCAN_DEMO_MODE=true). Never random —
// the same input always produces the same scenario, and no image is ever
// sent anywhere for analysis.

export const DEMO_SCENARIO_KEYS = ['fridge', 'cupboard', 'mixed', 'shopping'] as const;
export type DemoScenarioKey = (typeof DEMO_SCENARIO_KEYS)[number];

function items(names: string[]): RawScannedItem[] {
  return names.map((name) => ({ name, quantity: null, unit: null }));
}

const DEMO_SCENARIOS: Record<DemoScenarioKey, RawScannedItem[]> = {
  fridge: items(['Milk', 'Eggs', 'Chicken breast', 'Tomatoes', 'Cheese', 'Spinach']),
  cupboard: items(['Rice', 'Pasta', 'Beans', 'Canned tomatoes', 'Flour', 'Cooking oil']),
  mixed: items(['Chicken', 'Rice', 'Eggs', 'Onions', 'Tomatoes', 'Spinach']),
  shopping: items(['Bread', 'Bananas', 'Yoghurt', 'Chicken', 'Vegetables', 'Rice']),
};

export function demoScenario(key: DemoScenarioKey): RawScannedItem[] {
  return DEMO_SCENARIOS[key];
}

/**
 * Deterministically picks a scenario from an uploaded photo's own bytes, so
 * the same photo always yields the same demo result while different photos
 * still vary — a stable hash, not a random pick (same technique as
 * eat-now-estimates.ts's stableHash).
 */
export function demoScenarioForPhoto(imageBase64: string): RawScannedItem[] {
  let hash = 0;
  const sampleLength = Math.min(imageBase64.length, 2000);
  for (let i = 0; i < sampleLength; i++) {
    hash = (hash * 31 + imageBase64.charCodeAt(i)) >>> 0;
  }
  const key = DEMO_SCENARIO_KEYS[hash % DEMO_SCENARIO_KEYS.length];
  return DEMO_SCENARIOS[key];
}
