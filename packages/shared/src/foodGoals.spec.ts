import { FOOD_GOALS } from './foodGoals';

describe('FOOD_GOALS', () => {
  it('never includes body-shape or weight-loss framed values (Decision 13)', () => {
    const bannedTerms = ['weight_loss', 'lose_weight', 'body_shape', 'diet', 'bmi'];
    for (const goal of FOOD_GOALS) {
      for (const banned of bannedTerms) {
        expect(goal).not.toContain(banned);
      }
    }
  });

  it('includes the non-medical goal set defined in spec §10', () => {
    expect(FOOD_GOALS).toEqual([
      'balanced_meals',
      'support_fitness',
      'maintain_weight',
      'reduce_spending',
      'reduce_waste',
      'home_cooked',
      'explore_cuisines',
      'personal',
      'none',
    ]);
  });
});
