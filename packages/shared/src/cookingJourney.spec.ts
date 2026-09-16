import {
  computeTimerRemaining,
  emptyIngredientCheckState,
  isShoppingComplete,
  migrateIngredientCheckState,
  reconcileRescan,
  resolveJourneyDestination,
  summariseIngredientCheck,
  type CookingTimerState,
} from './cookingJourney';

describe('resolveJourneyDestination', () => {
  it('sends an in-progress cook straight back to cooking', () => {
    expect(resolveJourneyDestination({ stage: 'cooking' })).toBe('cooking');
    // even if the linked list is somehow "complete", an active cook wins (§27 priority 1)
    expect(resolveJourneyDestination({ stage: 'cooking', shoppingComplete: true })).toBe('cooking');
  });

  it('keeps a shopping journey on the list until every item is checked', () => {
    expect(resolveJourneyDestination({ stage: 'shopping', shoppingComplete: false })).toBe('shopping');
  });

  it('promotes a shopping journey to ready-to-cook once shopping is complete', () => {
    expect(resolveJourneyDestination({ stage: 'shopping', shoppingComplete: true })).toBe('ready_to_cook');
  });

  it('maps the remaining stages to their own destination', () => {
    expect(resolveJourneyDestination({ stage: 'ready_to_cook' })).toBe('ready_to_cook');
    expect(resolveJourneyDestination({ stage: 'ingredient_check' })).toBe('ingredient_check');
    expect(resolveJourneyDestination({ stage: 'recipe_selected' })).toBe('recipe_selected');
    expect(resolveJourneyDestination({ stage: 'feedback_pending' })).toBe('feedback_pending');
  });
});

describe('isShoppingComplete', () => {
  it('is true when every item is checked', () => {
    expect(isShoppingComplete([{ checked: true }, { checked: true }])).toBe(true);
  });
  it('is false while any item is unchecked', () => {
    expect(isShoppingComplete([{ checked: true }, { checked: false }])).toBe(false);
  });
  it('treats an empty list as complete (nothing left to buy)', () => {
    expect(isShoppingComplete([])).toBe(true);
  });
});

describe('computeTimerRemaining', () => {
  const now = new Date('2026-09-09T12:00:00.000Z');

  it('returns 0 when there is no timer', () => {
    const timer: CookingTimerState = { status: null, durationSeconds: null, endsAt: null, remainingSeconds: null };
    expect(computeTimerRemaining(timer, now)).toBe(0);
  });

  it('returns 0 when the timer is done', () => {
    const timer: CookingTimerState = { status: 'done', durationSeconds: 300, endsAt: null, remainingSeconds: 0 };
    expect(computeTimerRemaining(timer, now)).toBe(0);
  });

  it('counts down from a running endsAt against now', () => {
    const timer: CookingTimerState = {
      status: 'running',
      durationSeconds: 300,
      endsAt: '2026-09-09T12:03:20.000Z', // 200s ahead of now
      remainingSeconds: null,
    };
    expect(computeTimerRemaining(timer, now)).toBe(200);
  });

  it('clamps a running timer that has already elapsed to 0', () => {
    const timer: CookingTimerState = {
      status: 'running',
      durationSeconds: 300,
      endsAt: '2026-09-09T11:59:00.000Z', // 60s in the past
      remainingSeconds: null,
    };
    expect(computeTimerRemaining(timer, now)).toBe(0);
  });

  it('returns the frozen remaining while paused, ignoring elapsed wall time', () => {
    const timer: CookingTimerState = {
      status: 'paused',
      durationSeconds: 300,
      endsAt: null,
      remainingSeconds: 142,
    };
    // paused an hour ago; still 142s left on resume
    expect(computeTimerRemaining(timer, new Date('2026-09-09T13:00:00.000Z'))).toBe(142);
  });

  it('falls back to the full duration for a running timer with no endsAt yet', () => {
    const timer: CookingTimerState = { status: 'running', durationSeconds: 90, endsAt: null, remainingSeconds: null };
    expect(computeTimerRemaining(timer, now)).toBe(90);
  });
});

describe('migrateIngredientCheckState', () => {
  it('returns null when nothing is stored', () => {
    expect(migrateIngredientCheckState(null)).toBeNull();
    expect(migrateIngredientCheckState(undefined)).toBeNull();
    expect(migrateIngredientCheckState({})).toBeNull();
  });

  it('upgrades the legacy { have, need } shape to a reconciled v2 state', () => {
    const migrated = migrateIngredientCheckState({ have: ['Yam', 'Onion'], need: ['Palm oil', 'Stock'] });
    expect(migrated).toMatchObject({
      v: 2,
      subStage: 'reconciled',
      skipped: true,
      haveNames: ['Yam', 'Onion'],
      need: [
        { name: 'Palm oil', note: null },
        { name: 'Stock', note: null },
      ],
      detected: [],
      confirmedNames: [],
    });
  });

  it('passes a v2 state through, coercing bad fields to safe defaults', () => {
    const migrated = migrateIngredientCheckState({
      v: 2,
      subStage: 'reviewScan',
      skipped: false,
      scannedAt: '2026-09-09T12:00:00.000Z',
      detected: [{ name: 'Yam', quantity: null, unit: null }, { bogus: true }],
      confirmedNames: ['Yam', 42],
      manualHave: [{ name: 'Crayfish', quantity: '1', unit: 'cup' }],
      haveNames: ['Yam'],
      need: [{ name: 'Stock', note: '1 more' }, { note: 'orphan' }],
      purchasedNames: ['Palm oil'],
    });
    expect(migrated).toMatchObject({
      v: 2,
      subStage: 'reviewScan',
      detected: [{ name: 'Yam', quantity: null, unit: null }],
      confirmedNames: ['Yam'],
      manualHave: [{ name: 'Crayfish', quantity: '1', unit: 'cup' }],
      need: [{ name: 'Stock', note: '1 more' }],
      purchasedNames: ['Palm oil'],
    });
  });
});

describe('reconcileRescan (brief §22 priority)', () => {
  const prev = {
    detected: [
      { name: 'Yam', quantity: null, unit: null },
      { name: 'Onion', quantity: null, unit: null },
      { name: 'Milk', quantity: null, unit: null }, // user rejected this
    ],
    confirmedNames: ['Yam', 'Onion'],
  };

  it('keeps a user-confirmed item confirmed even if the new scan omits it', () => {
    const { confirmedNames } = reconcileRescan(prev, [{ name: 'Pepper', quantity: null, unit: null }]);
    expect(confirmedNames).toEqual(expect.arrayContaining(['Yam', 'Onion', 'Pepper']));
  });

  it('does not re-confirm an item the user previously rejected', () => {
    const { detected, confirmedNames } = reconcileRescan(prev, [{ name: 'Milk', quantity: null, unit: null }]);
    expect(detected.map((d) => d.name)).toContain('Milk'); // still offered
    expect(confirmedNames).not.toContain('Milk'); // but not silently re-added
  });

  it('adds a genuinely new detected item as confirmed', () => {
    const { confirmedNames } = reconcileRescan(prev, [{ name: 'Spinach', quantity: null, unit: null }]);
    expect(confirmedNames).toContain('Spinach');
  });

  it('lets the new scan win on quantity/unit for a kept item', () => {
    const { detected } = reconcileRescan(prev, [{ name: 'Yam', quantity: '2', unit: 'kg' }]);
    expect(detected.find((d) => d.name === 'Yam')).toEqual({ name: 'Yam', quantity: '2', unit: 'kg' });
  });
});

describe('summariseIngredientCheck', () => {
  it('counts kept / rejected / have / need / purchased', () => {
    const state = {
      ...emptyIngredientCheckState(),
      subStage: 'reconciled' as const,
      detected: [
        { name: 'Yam', quantity: null, unit: null },
        { name: 'Onion', quantity: null, unit: null },
        { name: 'Milk', quantity: null, unit: null },
      ],
      confirmedNames: ['Yam', 'Onion'],
      manualHave: [{ name: 'Crayfish', quantity: null, unit: null }],
      haveNames: ['Yam', 'Onion'],
      need: [{ name: 'Palm oil', note: null }, { name: 'Stock', note: null }],
      purchasedNames: ['Palm oil'],
    };
    expect(summariseIngredientCheck(state)).toEqual({
      kept: 2,
      rejected: 1,
      haveCount: 3,
      needCount: 2,
      purchasedCount: 1,
      detectedCount: 3,
    });
  });
});
