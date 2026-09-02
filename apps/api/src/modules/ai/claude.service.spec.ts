import { ClaudeService } from './claude.service';

// These exercise only the demo path (no ANTHROPIC_API_KEY) — the curated
// fallbacks, which run with no network.
describe('ClaudeService demo fallbacks', () => {
  const service = new ClaudeService();
  const savedKey = process.env.ANTHROPIC_API_KEY;

  beforeAll(() => {
    delete process.env.ANTHROPIC_API_KEY;
  });
  afterAll(() => {
    if (savedKey !== undefined) process.env.ANTHROPIC_API_KEY = savedKey;
  });

  describe('generatePlanMeals with allowGenericFallback', () => {
    it('always returns exactly `days` recipes even when the focus matches nothing', async () => {
      const recipes = await service.generatePlanMeals({
        days: 5,
        focus: 'Nigerian food',
        allowGenericFallback: true,
      });
      expect(recipes).toHaveLength(5);
    });

    it('fills past the curated pool size (up to 14 days)', async () => {
      const recipes = await service.generatePlanMeals({ days: 14, allowGenericFallback: true });
      expect(recipes).toHaveLength(14);
    });

    it('leads with hint matches when the focus does match', async () => {
      const recipes = await service.generatePlanMeals({
        days: 3,
        focus: 'pizza',
        allowGenericFallback: true,
      });
      expect(recipes).toHaveLength(3);
      expect(String(recipes[0].title).toLowerCase()).toContain('pizza');
    });
  });

  describe('generatePlanMeals without allowGenericFallback (single-day replace)', () => {
    it('returns nothing when a specific focus matches nothing curated', async () => {
      const recipes = await service.generatePlanMeals({ days: 1, focus: 'Nigerian food' });
      expect(recipes).toHaveLength(0);
    });
  });
});
