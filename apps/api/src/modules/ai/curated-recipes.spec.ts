import { CURATED_RECIPES, curatedPlanForDays, pickCuratedRecipes, scoreCuratedByHint } from './curated-recipes';

const minutes = (r: { cookTimeMinutes: unknown }) => Number(r.cookTimeMinutes);
const titles = (rs: { title: unknown }[]) => rs.map((r) => String(r.title));

describe('curated-recipes (guest / demo pool helpers)', () => {
  describe('pickCuratedRecipes', () => {
    it('leads with hint matches', () => {
      const picked = pickCuratedRecipes('pizza', 3);
      expect(picked).toHaveLength(3);
      expect(String(picked[0].title).toLowerCase()).toContain('pizza');
    });

    it('falls back to the pool (never empty) when the hint matches nothing', () => {
      const picked = pickCuratedRecipes('xyzzy no such food', 3);
      expect(picked).toHaveLength(3);
    });

    it('returns pool order for a blank hint', () => {
      const picked = pickCuratedRecipes('', 3);
      expect(titles(picked)).toEqual(titles(CURATED_RECIPES.slice(0, 3)));
    });

    it('honours a time constraint when the pool can satisfy it', () => {
      const picked = pickCuratedRecipes('rice noodles salad', 3, { maxMinutes: 15 });
      expect(picked.length).toBeGreaterThan(0);
      for (const r of picked) expect(minutes(r)).toBeLessThanOrEqual(15);
    });

    it('drops an impossible time constraint rather than returning nothing', () => {
      // "jacket potato" (60 min) is the only hint match; maxMinutes 10 would
      // empty the list, so the constraint is ignored and something is returned.
      const picked = pickCuratedRecipes('jacket potato', 2, { maxMinutes: 10 });
      expect(picked.length).toBeGreaterThan(0);
    });

    it('never repeats a title', () => {
      const picked = pickCuratedRecipes('', 10);
      expect(new Set(titles(picked)).size).toBe(picked.length);
    });

    it('never returns more than the pool holds', () => {
      const picked = pickCuratedRecipes('', CURATED_RECIPES.length + 50);
      expect(picked.length).toBeLessThanOrEqual(CURATED_RECIPES.length);
    });
  });

  describe('curatedPlanForDays', () => {
    it('always returns exactly `days` recipes, wrapping past the pool size', () => {
      expect(curatedPlanForDays(14)).toHaveLength(14);
      expect(curatedPlanForDays(3)).toHaveLength(3);
    });

    it('leads with hint matches when the focus matches', () => {
      const plan = curatedPlanForDays(3, 'pizza');
      expect(plan).toHaveLength(3);
      expect(String(plan[0].title).toLowerCase()).toContain('pizza');
    });
  });

  describe('scoreCuratedByHint', () => {
    it('scores by keyword overlap and drops zero-score entries', () => {
      const scored = scoreCuratedByHint('chicken curry');
      expect(scored.length).toBeGreaterThan(0);
      expect(scored.every((s) => s.score > 0)).toBe(true);
      expect(scored[0].score).toBeGreaterThanOrEqual(scored[scored.length - 1].score);
    });
  });
});
