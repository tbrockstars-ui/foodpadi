// Routing layer for the unified "What should I eat?" Home experience.
// Pure decision logic only — it decides WHICH existing engine (Eat Now vs.
// Cook Today) should handle a request and how to phrase the Eat Now query.
// It does not call any engine itself and introduces no new AI/recommendation
// logic; Plan Ahead stays a separate direct shortcut (multi-day planning
// isn't one of these situational chips).

export const SITUATION_CHIPS = [
  'quick',
  'cheap',
  'filling',
  'family',
  'use-what-i-have',
  'something-different',
] as const;

export type SituationChip = (typeof SITUATION_CHIPS)[number];

export type FoodDecisionTarget =
  | { engine: 'cook-today' }
  | { engine: 'eat-now'; query: string; maxPricePence?: number };

const CHIP_LABEL: Record<SituationChip, string> = {
  quick: 'Quick',
  cheap: 'Cheap',
  filling: 'Filling',
  family: 'Family',
  'use-what-i-have': 'Use what I have',
  'something-different': 'Something different',
};

// Eat Now's catalog already tags entries with these exact words
// (eat-now-catalog.ts), so they drive real keyword matches, not just labels.
const CHIP_QUERY_WORD: Partial<Record<SituationChip, string>> = {
  quick: 'quick',
  filling: 'filling',
  'something-different': 'different', // catalog has no matching tag by design — this is EatNowService's "surprise me" trigger, not a real keyword match
};

// A soft ceiling, mirroring EatNowService's own BUDGET_TIER_CEILING_PENCE
// for its "low" tier — "cheap" is a price filter, not a keyword, since no
// catalog entry literally contains the word "cheap".
const CHEAP_MAX_PRICE_PENCE = 800;

export function chipLabel(chip: SituationChip): string {
  return CHIP_LABEL[chip];
}

/**
 * "Family" and "Use what I have" both need real ingredient input that only
 * Cook Today's existing ingredient-picker can supply — there's no honest way
 * to answer them from a chip tap alone (no pantry/ingredient data exists),
 * so they route straight to that screen rather than trying to fabricate a
 * result. Everything else is an Eat Now-style single-recommendation ask.
 */
export function routeFoodDecision(selected: SituationChip[]): FoodDecisionTarget {
  if (selected.includes('family') || selected.includes('use-what-i-have')) {
    return { engine: 'cook-today' };
  }

  const queryWords = selected
    .map((chip) => CHIP_QUERY_WORD[chip])
    .filter((word): word is string => !!word);

  return {
    engine: 'eat-now',
    // "anything" is one of EatNowService's recognised surprise-me triggers —
    // when no chip contributes a real keyword (e.g. "Cheap" alone), this
    // skips keyword scoring entirely rather than matching on filler words.
    query: queryWords.length > 0 ? queryWords.join(' ') : 'anything',
    maxPricePence: selected.includes('cheap') ? CHEAP_MAX_PRICE_PENCE : undefined,
  };
}

export function whyLabel(selected: SituationChip[]): string {
  return selected.map(chipLabel).join(', ');
}
