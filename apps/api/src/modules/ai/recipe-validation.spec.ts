import { sanitizeRecipeCandidate } from './recipe-validation';
import type { RawRecipeCandidate } from './claude.service';

const validCandidate = (over: Partial<RawRecipeCandidate> = {}): RawRecipeCandidate => ({
  title: 'Test Dish',
  cookTimeMinutes: 20,
  servings: 2,
  cuisine: 'Italian',
  ingredients: [{ name: 'pasta', quantity: '200', unit: 'g' }],
  steps: ['Boil the pasta.', 'Toss with sauce.'],
  ...over,
});

describe('sanitizeRecipeCandidate', () => {
  it('returns a recipe with no stepDurationsSeconds when the field is absent', () => {
    const recipe = sanitizeRecipeCandidate(validCandidate());
    expect(recipe).not.toBeNull();
    expect(recipe!.stepDurationsSeconds).toBeUndefined();
  });

  it('keeps a valid stepDurationsSeconds array matching the step count', () => {
    const recipe = sanitizeRecipeCandidate(validCandidate({ stepDurationsSeconds: [300, null] }));
    expect(recipe!.stepDurationsSeconds).toEqual([300, null]);
  });

  it('rounds a non-integer duration', () => {
    const recipe = sanitizeRecipeCandidate(validCandidate({ stepDurationsSeconds: [180.6, null] }));
    expect(recipe!.stepDurationsSeconds).toEqual([181, null]);
  });

  it('drops the whole field when the array length does not match the step count', () => {
    const recipe = sanitizeRecipeCandidate(validCandidate({ stepDurationsSeconds: [300] }));
    expect(recipe).not.toBeNull(); // the recipe itself is still kept
    expect(recipe!.stepDurationsSeconds).toBeUndefined();
  });

  it('drops the whole field when an entry is negative or zero', () => {
    expect(sanitizeRecipeCandidate(validCandidate({ stepDurationsSeconds: [0, 60] }))!.stepDurationsSeconds).toBeUndefined();
    expect(sanitizeRecipeCandidate(validCandidate({ stepDurationsSeconds: [-5, 60] }))!.stepDurationsSeconds).toBeUndefined();
  });

  it('drops the whole field when an entry is absurdly long (> 3 hours)', () => {
    const recipe = sanitizeRecipeCandidate(validCandidate({ stepDurationsSeconds: [3 * 60 * 60 + 1, 60] }));
    expect(recipe!.stepDurationsSeconds).toBeUndefined();
  });

  it('drops the whole field when an entry is not a number or null', () => {
    const recipe = sanitizeRecipeCandidate(validCandidate({ stepDurationsSeconds: ['soon', 60] }));
    expect(recipe!.stepDurationsSeconds).toBeUndefined();
  });

  it('never lets a malformed stepDurationsSeconds sink an otherwise-valid recipe', () => {
    const recipe = sanitizeRecipeCandidate(validCandidate({ stepDurationsSeconds: 'not an array' }));
    expect(recipe).not.toBeNull();
    expect(recipe!.title).toBe('Test Dish');
  });

  describe('prepTimeMinutes', () => {
    it('returns a recipe with no prepTimeMinutes when the field is absent', () => {
      const recipe = sanitizeRecipeCandidate(validCandidate());
      expect(recipe!.prepTimeMinutes).toBeUndefined();
    });

    it('returns a recipe with no prepTimeMinutes when the field is explicitly null', () => {
      const recipe = sanitizeRecipeCandidate(validCandidate({ prepTimeMinutes: null }));
      expect(recipe!.prepTimeMinutes).toBeUndefined();
    });

    it('keeps a valid prepTimeMinutes strictly less than cookTimeMinutes', () => {
      const recipe = sanitizeRecipeCandidate(validCandidate({ cookTimeMinutes: 20, prepTimeMinutes: 5 }));
      expect(recipe!.prepTimeMinutes).toBe(5);
    });

    it('rounds a non-integer prep time', () => {
      const recipe = sanitizeRecipeCandidate(validCandidate({ cookTimeMinutes: 20, prepTimeMinutes: 4.6 }));
      expect(recipe!.prepTimeMinutes).toBe(5);
    });

    it('drops the field when prep time is zero or negative', () => {
      expect(sanitizeRecipeCandidate(validCandidate({ prepTimeMinutes: 0 }))!.prepTimeMinutes).toBeUndefined();
      expect(sanitizeRecipeCandidate(validCandidate({ prepTimeMinutes: -3 }))!.prepTimeMinutes).toBeUndefined();
    });

    it('drops the field when prep time equals the total (no room for an "active cook" figure)', () => {
      const recipe = sanitizeRecipeCandidate(validCandidate({ cookTimeMinutes: 20, prepTimeMinutes: 20 }));
      expect(recipe!.prepTimeMinutes).toBeUndefined();
    });

    it('drops the field when prep time exceeds the total', () => {
      const recipe = sanitizeRecipeCandidate(validCandidate({ cookTimeMinutes: 20, prepTimeMinutes: 25 }));
      expect(recipe!.prepTimeMinutes).toBeUndefined();
    });

    it('drops the field when it is not a number', () => {
      const recipe = sanitizeRecipeCandidate(validCandidate({ prepTimeMinutes: 'a bit' }));
      expect(recipe!.prepTimeMinutes).toBeUndefined();
    });

    it('never lets a malformed prepTimeMinutes sink an otherwise-valid recipe', () => {
      const recipe = sanitizeRecipeCandidate(validCandidate({ cookTimeMinutes: 20, prepTimeMinutes: 999 }));
      expect(recipe).not.toBeNull();
      expect(recipe!.title).toBe('Test Dish');
    });
  });
});
