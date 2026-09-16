import { ClaudeService } from './claude.service';
import { CURATED_RECIPES } from './curated-recipes';

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

  describe('generateCookTodayRecipes excludeTitles ("None of these? Try another set")', () => {
    it('never returns an excluded title', async () => {
      const first = await service.generateCookTodayRecipes({ ingredients: ['chicken'] });
      const firstTitles = first.map((r) => String(r.title));
      const again = await service.generateCookTodayRecipes({
        ingredients: ['chicken'],
        excludeTitles: firstTitles,
      });
      for (const r of again) expect(firstTitles).not.toContain(String(r.title));
    });

    it('falls back to the full pool (never empty) when excluding every curated title', async () => {
      const everyTitle = CURATED_RECIPES.map((r) => String(r.title));
      const recipes = await service.generateCookTodayRecipes({ ingredients: [], excludeTitles: everyTitle });
      expect(recipes.length).toBeGreaterThan(0);
    });
  });
});

// CookingInsightsService's cross-customer "what other cooks reported" signal
// (communityNotes) — verifies it lands in the USER prompt only, never the
// safety SYSTEM prompt, and never changes the prompt at all when absent.
// Mocks the Anthropic SDK directly so no network call is made.
const createMock = jest.fn();
jest.mock('@anthropic-ai/sdk', () => {
  return jest.fn().mockImplementation(() => ({
    messages: { create: createMock },
  }));
});

describe('ClaudeService communityNotes prompt wiring', () => {
  const savedKey = process.env.ANTHROPIC_API_KEY;

  beforeAll(() => {
    process.env.ANTHROPIC_API_KEY = 'test-key';
  });
  afterAll(() => {
    if (savedKey === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = savedKey;
  });
  beforeEach(() => {
    createMock.mockReset();
    createMock.mockResolvedValue({ content: [{ type: 'text', text: JSON.stringify({ recipes: [] }) }] });
  });

  it('generateCookTodayRecipes appends communityNotes to the user message only', async () => {
    const service = new ClaudeService();
    await service.generateCookTodayRecipes({
      ingredients: ['chicken'],
      communityNotes: 'Cooks who have cooked with FoodPadi recently reported: timings ran long.',
    });

    expect(createMock).toHaveBeenCalledTimes(1);
    const call = createMock.mock.calls[0][0];
    expect(call.messages[0].content).toContain('timings ran long');
    expect(call.system).not.toContain('timings ran long');
  });

  it('generateCookTodayRecipes leaves the prompt unchanged when communityNotes is absent', async () => {
    const service = new ClaudeService();
    await service.generateCookTodayRecipes({ ingredients: ['chicken'] });
    await service.generateCookTodayRecipes({ ingredients: ['chicken'], communityNotes: undefined });

    const [withoutField, withUndefinedField] = createMock.mock.calls.map((c) => c[0].messages[0].content);
    expect(withoutField).toBe(withUndefinedField);
  });

  it('generatePlanMeals appends communityNotes to the user message only', async () => {
    const service = new ClaudeService();
    await service.generatePlanMeals({
      days: 1,
      communityNotes: 'Cooks reported quantities were unclear.',
    });

    expect(createMock).toHaveBeenCalledTimes(1);
    const call = createMock.mock.calls[0][0];
    expect(call.messages[0].content).toContain('quantities were unclear');
    expect(call.system).not.toContain('quantities were unclear');
  });

  it('generatePlanMeals leaves the prompt unchanged when communityNotes is absent', async () => {
    const service = new ClaudeService();
    await service.generatePlanMeals({ days: 1 });
    await service.generatePlanMeals({ days: 1, communityNotes: undefined });

    const [withoutField, withUndefinedField] = createMock.mock.calls.map((c) => c[0].messages[0].content);
    expect(withoutField).toBe(withUndefinedField);
  });
});
