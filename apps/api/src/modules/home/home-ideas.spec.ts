import { difficultyOf, pantryMatchPercent, priceBandOf, rankHomeIdeas, type IdeaContext } from './home-ideas';

const recipe = (over: Partial<Parameters<typeof difficultyOf>[0]> = {}) => ({
  title: 'Test Dish',
  cookTimeMinutes: 20,
  servings: 2,
  cuisine: 'Italian',
  ingredients: [
    { name: 'pasta', quantity: '200', unit: 'g' },
    { name: 'tomato', quantity: '3', unit: null },
    { name: 'garlic', quantity: '1', unit: 'clove' },
    { name: 'basil', quantity: null, unit: null },
  ],
  steps: ['Boil', 'Toss'],
  ...over,
});

const ctx = (over: Partial<IdeaContext> = {}): IdeaContext => ({
  pantryItems: [],
  avoidedIngredients: [],
  favouriteCuisines: [],
  activeGoals: [],
  ...over,
});

describe('pantryMatchPercent', () => {
  it('is null when there is no pantry to score against', () => {
    expect(pantryMatchPercent(recipe(), [])).toBeNull();
  });

  it('is a real overlap percentage, with fuzzy name matching both ways', () => {
    // pantry "tomatoes" covers ingredient "tomato"; "garlic cloves" covers "garlic"
    expect(pantryMatchPercent(recipe(), ['pasta', 'tomatoes', 'garlic cloves'])).toBe(75);
  });

  it('is 0 when the pantry covers none of the ingredients', () => {
    expect(pantryMatchPercent(recipe(), ['rice', 'chicken'])).toBe(0);
  });
});

describe('difficultyOf', () => {
  it('Easy for short & few-step recipes', () => {
    expect(difficultyOf(recipe({ cookTimeMinutes: 15, steps: ['a', 'b'] }))).toBe('Easy');
  });
  it('Hard for long or many-step recipes', () => {
    expect(difficultyOf(recipe({ cookTimeMinutes: 60, steps: ['a', 'b'] }))).toBe('Hard');
    expect(difficultyOf(recipe({ cookTimeMinutes: 20, steps: ['a', 'b', 'c', 'd', 'e'] }))).toBe('Hard');
  });
  it('Medium otherwise', () => {
    expect(difficultyOf(recipe({ cookTimeMinutes: 40, steps: ['a', 'b', 'c'] }))).toBe('Medium');
  });
});

describe('priceBandOf', () => {
  it('£ for a short meat-free ingredient list', () => {
    expect(priceBandOf(recipe())).toBe('£');
  });
  it('££ when it contains meat or fish', () => {
    expect(priceBandOf(recipe({ ingredients: [{ name: 'chicken breast', quantity: '2', unit: null }] }))).toBe('££');
  });
  it('£££ for premium proteins', () => {
    expect(priceBandOf(recipe({ ingredients: [{ name: 'salmon fillet', quantity: '2', unit: null }] }))).toBe('£££');
  });
});

describe('rankHomeIdeas', () => {
  it('never returns an avoided recipe', () => {
    const pool = [
      recipe({ title: 'Peanut Noodles', ingredients: [{ name: 'peanut butter', quantity: '3', unit: 'tbsp' }] }),
      recipe({ title: 'Plain Pasta' }),
    ];
    const ideas = rankHomeIdeas(ctx({ avoidedIngredients: ['peanut'] }), pool);
    expect(ideas.map((i) => i.title)).not.toContain('Peanut Noodles');
  });

  it('with a pantry, ranks the strongest match first and flags it bestMatch', () => {
    const pool = [
      recipe({ title: 'Big Shop', ingredients: [{ name: 'quail', quantity: '1', unit: null }, { name: 'saffron', quantity: '1', unit: 'g' }] }),
      recipe({ title: 'Use What I Have', ingredients: [{ name: 'pasta', quantity: '1', unit: null }, { name: 'tomato', quantity: '1', unit: null }] }),
    ];
    const ideas = rankHomeIdeas(ctx({ pantryItems: ['pasta', 'tomatoes'] }), pool);
    expect(ideas[0].title).toBe('Use What I Have');
    expect(ideas[0].matchPercent).toBe(100);
    expect(ideas[0].bestMatch).toBe(true);
    expect(ideas[1].bestMatch).toBe(false);
  });

  it('for a guest (no pantry), returns a stable ordering with null matchPercent and no bestMatch', () => {
    const pool = [recipe({ title: 'Slow', cookTimeMinutes: 50 }), recipe({ title: 'Quick', cookTimeMinutes: 10 })];
    const ideas = rankHomeIdeas(ctx(), pool);
    expect(ideas.every((i) => i.matchPercent === null)).toBe(true);
    expect(ideas.some((i) => i.bestMatch)).toBe(false);
    expect(ideas[0].title).toBe('Quick'); // tiebreak: quicker first
  });

  it('carries the full recipe so the save action needs no extra fetch', () => {
    const ideas = rankHomeIdeas(ctx(), [recipe()]);
    expect(ideas[0].recipe.steps).toEqual(['Boil', 'Toss']);
    expect(ideas[0].recipe.ingredients[0]).toEqual({ name: 'pasta', quantity: '200', unit: 'g' });
  });

  describe('live mood/time/budget signals', () => {
    it('moodHint ranks a keyword-matching recipe above one that does not match', () => {
      const pool = [
        recipe({ title: 'Beef Stew', cuisine: 'British' }),
        recipe({ title: 'Spicy Curry Bowl', cuisine: 'Indian' }),
      ];
      const ideas = rankHomeIdeas(ctx({ moodHint: 'spicy curry' }), pool);
      expect(ideas[0].title).toBe('Spicy Curry Bowl');
    });

    it('maxTimeMinutes filters out anything over the cap, best-effort', () => {
      const pool = [recipe({ title: 'Quick', cookTimeMinutes: 15 }), recipe({ title: 'Slow', cookTimeMinutes: 60 })];
      const ideas = rankHomeIdeas(ctx({ maxTimeMinutes: 20 }), pool);
      expect(ideas.map((i) => i.title)).toEqual(['Quick']);
    });

    it('maxTimeMinutes is dropped rather than emptying the feed when nothing fits', () => {
      const pool = [recipe({ title: 'Only Option', cookTimeMinutes: 60 })];
      const ideas = rankHomeIdeas(ctx({ maxTimeMinutes: 10 }), pool);
      expect(ideas.map((i) => i.title)).toEqual(['Only Option']);
    });

    it('maxBudgetPence filters out recipes over the cap, best-effort', () => {
      const pool = [
        recipe({ title: 'Cheap Pasta' }), // £ band
        recipe({ title: 'Salmon Dinner', ingredients: [{ name: 'salmon fillet', quantity: '2', unit: null }] }), // £££ band
      ];
      const ideas = rankHomeIdeas(ctx({ maxBudgetPence: 600 }), pool);
      expect(ideas.map((i) => i.title)).toEqual(['Cheap Pasta']);
    });

    it('maxBudgetPence is dropped rather than emptying the feed when nothing fits', () => {
      const pool = [recipe({ title: 'Only Option', ingredients: [{ name: 'salmon fillet', quantity: '2', unit: null }] })];
      const ideas = rankHomeIdeas(ctx({ maxBudgetPence: 100 }), pool);
      expect(ideas.map((i) => i.title)).toEqual(['Only Option']);
    });

    it('a "vegan" moodHint hard-filters to vegan-titled recipes — never a best-effort fallback', () => {
      const pool = [
        recipe({ title: 'Vegan Lentil Dahl' }),
        recipe({ title: 'Chicken & Avocado Salad' }),
        recipe({ title: 'Greek Salad' }),
      ];
      const ideas = rankHomeIdeas(ctx({ moodHint: 'Something vegan' }), pool);
      expect(ideas.map((i) => i.title)).toEqual(['Vegan Lentil Dahl']);
    });

    it('a "vegan" moodHint can legitimately empty the feed — unlike maxTime/maxBudget, it never falls back to a non-vegan pick', () => {
      const pool = [recipe({ title: 'Chicken & Avocado Salad' }), recipe({ title: 'Greek Salad' })];
      const ideas = rankHomeIdeas(ctx({ moodHint: 'Something vegan' }), pool);
      expect(ideas).toEqual([]);
    });

    it('a moodHint that just happens to mention vegan mid-sentence still triggers the filter', () => {
      const pool = [recipe({ title: 'Vegan Lentil Dahl' }), recipe({ title: 'Beef Stew' })];
      const ideas = rankHomeIdeas(ctx({ moodHint: 'something vegan and quick' }), pool);
      expect(ideas.map((i) => i.title)).toEqual(['Vegan Lentil Dahl']);
    });

    it('no "vegan" in moodHint leaves non-vegan recipes in the feed', () => {
      const pool = [recipe({ title: 'Vegan Lentil Dahl' }), recipe({ title: 'Chicken & Avocado Salad' })];
      const ideas = rankHomeIdeas(ctx({ moodHint: 'something quick' }), pool);
      expect(ideas.map((i) => i.title).sort()).toEqual(['Chicken & Avocado Salad', 'Vegan Lentil Dahl']);
    });
  });
});
