import { dropRecipesWithAvoided, matchesAvoidedTerm } from './avoided-ingredients';

describe('matchesAvoidedTerm', () => {
  it('matches case-insensitively as a substring', () => {
    expect(matchesAvoidedTerm('Peanut Butter Noodles', ['peanut'])).toBe(true);
    expect(matchesAvoidedTerm('peanut butter noodles', ['PEANUT'])).toBe(true);
  });

  it('does not match when the term is absent', () => {
    expect(matchesAvoidedTerm('Tomato & Basil Pasta', ['peanut'])).toBe(false);
  });

  it('matches if any term in the list matches', () => {
    expect(matchesAvoidedTerm('Shellfish Paella', ['peanut', 'shellfish', 'mushroom'])).toBe(true);
  });

  it('returns false with an empty term list', () => {
    expect(matchesAvoidedTerm('Anything at all', [])).toBe(false);
  });

  it('ignores blank/whitespace-only terms rather than matching everything', () => {
    expect(matchesAvoidedTerm('Tomato & Basil Pasta', ['', '   '])).toBe(false);
  });

  it('trims whitespace around a term before matching', () => {
    expect(matchesAvoidedTerm('Peanut Butter Noodles', ['  peanut  '])).toBe(true);
  });
});

describe('dropRecipesWithAvoided', () => {
  const recipe = (title: string, ingredientNames: string[]) => ({
    title,
    ingredients: ingredientNames.map((name) => ({ name })),
  });

  it('drops a recipe whose title names an avoided term', () => {
    const recipes = [recipe('Peanut Satay Noodles', ['noodles', 'soy sauce']), recipe('Tomato Pasta', ['pasta', 'tomato'])];
    const result = dropRecipesWithAvoided(recipes, ['peanut']);
    expect(result.map((r) => r.title)).toEqual(['Tomato Pasta']);
  });

  it('drops a recipe whose ingredient list (not just title) names an avoided term', () => {
    const recipes = [recipe('Asian Noodle Bowl', ['noodles', 'peanut sauce']), recipe('Tomato Pasta', ['pasta', 'tomato'])];
    const result = dropRecipesWithAvoided(recipes, ['peanut']);
    expect(result.map((r) => r.title)).toEqual(['Tomato Pasta']);
  });

  it('returns every recipe unchanged when nothing is avoided', () => {
    const recipes = [recipe('Peanut Satay Noodles', ['peanut']), recipe('Tomato Pasta', ['tomato'])];
    expect(dropRecipesWithAvoided(recipes, [])).toEqual(recipes);
  });

  it('can filter out every candidate, returning an empty list rather than falling back silently', () => {
    const recipes = [recipe('Peanut Satay Noodles', ['peanut']), recipe('Peanut Butter Cookies', ['peanut butter'])];
    expect(dropRecipesWithAvoided(recipes, ['peanut'])).toEqual([]);
  });
});
