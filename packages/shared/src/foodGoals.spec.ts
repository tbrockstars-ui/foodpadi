import { FOOD_GOALS } from './foodGoals';

describe('FOOD_GOALS', () => {
  it('never includes body-shape or weight-loss framed values (Decision 13)', () => {
    const bannedTerms = ['weight_loss', 'lose_weight', 'body_shape', 'diet', 'bmi', 'calorie'];
    for (const goal of FOOD_GOALS) {
      for (const banned of bannedTerms) {
        expect(goal).not.toContain(banned);
      }
    }
  });

  it('is the non-medical goal set defined in spec §10, ending with personal + none', () => {
    expect(FOOD_GOALS).toEqual([
      'balanced_meals',
      'eat_more_plants',
      'quick_meals',
      'reduce_spending',
      'reduce_waste',
      'home_cooked',
      'explore_cuisines',
      'cook_for_others',
      'support_fitness',
      'maintain_weight',
      'personal',
      'none',
    ]);
    expect(FOOD_GOALS.slice(-2)).toEqual(['personal', 'none']);
  });
});
