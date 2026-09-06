import {
  confidenceForEvidence,
  confidenceTier,
  decayConfidence,
  detectBudgetPattern,
  detectCookDurationPattern,
  detectCuisinePatterns,
  detectDayRoutinePatterns,
  detectMealRepetitionPatterns,
  detectMealTimePatterns,
  detectPantryPatterns,
  detectRecipeFeedbackPatterns,
  detectCuisineFeedbackPatterns,
  detectPlanSatisfactionPattern,
  STALE_AFTER_DAYS,
  STALE_FLOOR,
} from './pattern.service';

const d = (iso: string) => new Date(iso);

describe('confidenceForEvidence', () => {
  it('is zero below the minimum-evidence threshold — one occurrence is never a pattern', () => {
    expect(confidenceForEvidence(0)).toBe(0);
    expect(confidenceForEvidence(1)).toBe(0);
  });

  it('rises with evidence count and caps below 1.0 (never total certainty)', () => {
    expect(confidenceForEvidence(2)).toBeCloseTo(0.35);
    expect(confidenceForEvidence(5)).toBeCloseTo(0.6);
    expect(confidenceForEvidence(8)).toBeGreaterThan(confidenceForEvidence(5));
    expect(confidenceForEvidence(100)).toBeLessThan(1);
    expect(confidenceForEvidence(100)).toBeLessThanOrEqual(0.95);
  });
});

describe('confidenceTier', () => {
  it('maps confidence to the copy register (brief §6)', () => {
    expect(confidenceTier(0.3)).toBe('low');
    expect(confidenceTier(0.6)).toBe('medium');
    expect(confidenceTier(0.85)).toBe('high');
  });
});

describe('decayConfidence', () => {
  it('leaves a recently-observed pattern untouched', () => {
    const now = d('2026-01-30T00:00:00Z');
    const lastObserved = d('2026-01-20T00:00:00Z'); // 10 days ago
    expect(decayConfidence(0.6, lastObserved, now)).toEqual({ confidence: 0.6, status: 'active' });
  });

  it('decays a pattern that has not been reinforced in a while', () => {
    const lastObserved = d('2026-02-01T00:00:00Z');
    const now = new Date(lastObserved.getTime() + STALE_AFTER_DAYS * 86_400_000);
    const result = decayConfidence(0.6, lastObserved, now);
    expect(result.confidence).toBeCloseTo(0.6 * 0.85);
    expect(result.status).toBe('active');
  });

  it('flips to stale once confidence decays below the floor', () => {
    const now = d('2026-04-01T00:00:00Z');
    const lastObserved = d('2026-01-01T00:00:00Z'); // ~90 days — several decay periods
    const result = decayConfidence(0.3, lastObserved, now);
    expect(result.confidence).toBeLessThan(STALE_FLOOR);
    expect(result.status).toBe('stale');
  });
});

describe('detectMealTimePatterns', () => {
  it('finds no pattern from a single occurrence', () => {
    expect(detectMealTimePatterns([{ occurredAt: d('2026-01-05T18:10:00') }])).toHaveLength(0);
  });

  it('detects a weekday dinner window after repeated decisions in the same half-hour bucket', () => {
    // 2026-01-05 is a Monday; cluster three weekday evenings around 18:00-18:29.
    const events = [
      { occurredAt: d('2026-01-05T18:00:00') },
      { occurredAt: d('2026-01-06T18:05:00') },
      { occurredAt: d('2026-01-07T18:10:00') },
    ];
    const patterns = detectMealTimePatterns(events);
    expect(patterns).toHaveLength(1);
    expect(patterns[0]).toMatchObject({ patternType: 'meal_time', patternKey: 'weekday_dinner', patternValue: '18:00', evidenceCount: 3 });
  });

  it('keeps weekday and weekend windows separate', () => {
    const events = [
      { occurredAt: d('2026-01-05T18:00:00') }, // Mon
      { occurredAt: d('2026-01-06T18:00:00') }, // Tue
      { occurredAt: d('2026-01-10T13:00:00') }, // Sat
      { occurredAt: d('2026-01-11T13:00:00') }, // Sun
    ];
    const patterns = detectMealTimePatterns(events);
    const keys = patterns.map((p) => p.patternKey).sort();
    expect(keys).toEqual(['weekday_dinner', 'weekend_dinner']);
  });
});

describe('detectDayRoutinePatterns', () => {
  it('detects a Friday eat-out routine from a clear majority', () => {
    const items = [
      { plannedDate: d('2026-01-02T00:00:00'), mealChoice: 'eat_out' }, // Friday
      { plannedDate: d('2026-01-09T00:00:00'), mealChoice: 'eat_out' },
      { plannedDate: d('2026-01-16T00:00:00'), mealChoice: 'eat_out' },
    ];
    const patterns = detectDayRoutinePatterns(items);
    expect(patterns).toEqual([
      expect.objectContaining({ patternType: 'day_routine', patternKey: 'friday', patternValue: 'eat_out', evidenceCount: 3 }),
    ]);
  });

  it('does not report a routine from a roughly even split', () => {
    const items = [
      { plannedDate: d('2026-01-02T00:00:00'), mealChoice: 'eat_out' },
      { plannedDate: d('2026-01-09T00:00:00'), mealChoice: 'cook' },
      { plannedDate: d('2026-01-16T00:00:00'), mealChoice: 'eat_out' },
      { plannedDate: d('2026-01-23T00:00:00'), mealChoice: 'cook' },
    ];
    expect(detectDayRoutinePatterns(items)).toHaveLength(0);
  });

  it('an old routine disappears once enough contrary evidence dominates the window', () => {
    // 8 weeks of "cook" after an earlier "eat_out" streak — brief §19 example.
    const cookWeeks = Array.from({ length: 8 }, (_, i) => ({
      plannedDate: new Date(d('2026-03-06T00:00:00').getTime() + i * 7 * 86_400_000),
      mealChoice: 'cook',
    }));
    const patterns = detectDayRoutinePatterns(cookWeeks);
    expect(patterns[0]).toMatchObject({ patternValue: 'cook' });
  });
});

describe('detectMealRepetitionPatterns', () => {
  it('requires 3+ occurrences of the same title', () => {
    const two = [
      { title: 'Jollof Rice', createdAt: d('2026-01-01') },
      { title: 'Jollof Rice', createdAt: d('2026-01-08') },
    ];
    expect(detectMealRepetitionPatterns(two)).toHaveLength(0);

    const three = [...two, { title: 'Jollof Rice', createdAt: d('2026-01-15') }];
    expect(detectMealRepetitionPatterns(three)).toEqual([
      expect.objectContaining({ patternType: 'meal_repetition', patternKey: 'Jollof Rice', evidenceCount: 3 }),
    ]);
  });
});

describe('detectCuisinePatterns', () => {
  it('groups case-insensitively but keeps the original display casing', () => {
    const recipes = [
      { cuisine: 'Nigerian', createdAt: d('2026-01-01') },
      { cuisine: 'nigerian', createdAt: d('2026-01-08') },
      { cuisine: 'NIGERIAN', createdAt: d('2026-01-15') },
    ];
    const patterns = detectCuisinePatterns(recipes);
    expect(patterns).toEqual([
      expect.objectContaining({ patternType: 'cuisine_frequency', patternKey: 'nigerian', patternValue: 'Nigerian', evidenceCount: 3 }),
    ]);
  });
});

describe('detectCookDurationPattern', () => {
  it('reports a typical duration only when requests cluster tightly', () => {
    const tight = [25, 30, 30].map((m, i) => ({ occurredAt: d(`2026-01-0${i + 1}`), timeConstraintMinutes: m }));
    expect(detectCookDurationPattern(tight)).toEqual([
      expect.objectContaining({ patternType: 'cook_duration', patternValue: '25-30 min', evidenceCount: 3 }),
    ]);
  });

  it('reports nothing when requests are all over the place', () => {
    const spread = [15, 60, 240].map((m, i) => ({ occurredAt: d(`2026-01-0${i + 1}`), timeConstraintMinutes: m }));
    expect(detectCookDurationPattern(spread)).toHaveLength(0);
  });
});

describe('detectBudgetPattern', () => {
  it('reports a typical budget range from clustered values', () => {
    const events = [600, 700, 650].map((p, i) => ({ occurredAt: d(`2026-01-0${i + 1}`), budgetPence: p }));
    const patterns = detectBudgetPattern(events);
    expect(patterns[0].patternValue).toBe('£6-£7');
  });
});

describe('detectPantryPatterns', () => {
  it('requires 3+ sightings of the same ingredient', () => {
    const items = [
      { name: 'Rice', createdAt: d('2026-01-01') },
      { name: 'rice', createdAt: d('2026-01-08') },
    ];
    expect(detectPantryPatterns(items)).toHaveLength(0);
    items.push({ name: 'RICE', createdAt: d('2026-01-15') });
    expect(detectPantryPatterns(items)).toEqual([
      expect.objectContaining({ patternType: 'pantry_ingredient', patternKey: 'rice', evidenceCount: 3 }),
    ]);
  });
});

describe('detectRecipeFeedbackPatterns (Feedback & Rating brief §4/§9)', () => {
  it('one explicit rating already crosses the evidence floor — stronger than a single passive event', () => {
    const feedback = [{ entityId: 'r1', rating: 5, createdAt: d('2026-01-01') }];
    const patterns = detectRecipeFeedbackPatterns(feedback);
    expect(patterns).toEqual([
      expect.objectContaining({ patternType: 'recipe_feedback', patternKey: 'r1', patternValue: 'positive', evidenceCount: 2 }),
    ]);
    expect(confidenceForEvidence(patterns[0].evidenceCount)).toBeGreaterThan(0);
  });

  it('reports negative sentiment for consistently low ratings', () => {
    const feedback = [
      { entityId: 'r2', rating: 1, createdAt: d('2026-01-01') },
      { entityId: 'r2', rating: 2, createdAt: d('2026-01-08') },
    ];
    expect(detectRecipeFeedbackPatterns(feedback)).toEqual([
      expect.objectContaining({ patternType: 'recipe_feedback', patternKey: 'r2', patternValue: 'negative' }),
    ]);
  });

  it('a mixed bag of ratings is not a usable signal — reports nothing rather than guessing', () => {
    const feedback = [
      { entityId: 'r3', rating: 5, createdAt: d('2026-01-01') },
      { entityId: 'r3', rating: 1, createdAt: d('2026-01-08') },
    ];
    expect(detectRecipeFeedbackPatterns(feedback)).toHaveLength(0);
  });
});

describe('detectCuisineFeedbackPatterns', () => {
  it('aggregates rated recipes by cuisine, case-insensitively', () => {
    const feedback = [
      { cuisine: 'Nigerian', rating: 5, createdAt: d('2026-01-01') },
      { cuisine: 'nigerian', rating: 4, createdAt: d('2026-01-08') },
    ];
    expect(detectCuisineFeedbackPatterns(feedback)).toEqual([
      expect.objectContaining({ patternType: 'cuisine_feedback', patternKey: 'nigerian', patternValue: 'Nigerian:positive' }),
    ]);
  });
});

describe('detectPlanSatisfactionPattern', () => {
  it('reports nothing without any plan feedback yet', () => {
    expect(detectPlanSatisfactionPattern([])).toHaveLength(0);
  });

  it('averages plan ratings into one rolling satisfaction signal', () => {
    const feedback = [
      { rating: 5, createdAt: d('2026-01-01') },
      { rating: 3, createdAt: d('2026-01-08') },
    ];
    expect(detectPlanSatisfactionPattern(feedback)).toEqual([
      expect.objectContaining({ patternType: 'plan_satisfaction', patternKey: 'overall', patternValue: '4.0' }),
    ]);
  });
});
