import { CookingInsightsService } from './cooking-insights.service';
import { PrismaService } from '../../prisma/prisma.service';

// CookingInsightsService is the cross-customer "what other cooks reported"
// signal — see its own doc comment. Every test below stays well inside its
// privacy thresholds unless a test is specifically checking that threshold.
describe('CookingInsightsService', () => {
  let prisma: {
    foodFeedback: { findMany: jest.Mock };
    recipe: { findMany: jest.Mock };
  };
  let service: CookingInsightsService;

  beforeEach(() => {
    prisma = {
      foodFeedback: { findMany: jest.fn().mockResolvedValue([]) },
      recipe: { findMany: jest.fn().mockResolvedValue([]) },
    };
    service = new CookingInsightsService(prisma as unknown as PrismaService);
  });

  function feedbackRow(entityId: string, rating: number, tags: string[] = [], comment: string | null = null) {
    return { entityId, rating, tags, comment };
  }

  describe('getInsightForDish', () => {
    it('returns null below the minimum-cooks-for-signal threshold', async () => {
      prisma.foodFeedback.findMany.mockResolvedValue([
        feedbackRow('r1', 3),
        feedbackRow('r2', 4),
      ]);
      prisma.recipe.findMany.mockResolvedValue([
        { id: 'r1', title: 'Jollof Rice' },
        { id: 'r2', title: 'Jollof Rice' },
      ]);

      const insight = await service.getInsightForDish('Jollof Rice');
      expect(insight).toBeNull();
    });

    it('returns null for an empty/whitespace title without querying', async () => {
      const insight = await service.getInsightForDish('   ');
      expect(insight).toBeNull();
      expect(prisma.foodFeedback.findMany).not.toHaveBeenCalled();
    });

    it('aggregates once at least 3 cooks of the same normalised dish exist', async () => {
      prisma.foodFeedback.findMany.mockResolvedValue([
        feedbackRow('r1', 5),
        feedbackRow('r2', 4),
        feedbackRow('r3', 3),
      ]);
      prisma.recipe.findMany.mockResolvedValue([
        { id: 'r1', title: 'Jollof Rice' },
        { id: 'r2', title: 'jollof rice' },
        { id: 'r3', title: 'The Jollof Rice' },
      ]);

      const insight = await service.getInsightForDish('a Jollof Rice');
      expect(insight).not.toBeNull();
      expect(insight!.cookCount).toBe(3);
      // avg of 5,4,3 = 4
      expect(insight!.avgRating).toBe(4);
      // 2 of 3 rated >= 4
      expect(insight!.wouldMakeAgainRate).toBe(0.67);
    });

    it('only counts feedback for recipes matching the normalised dish key', async () => {
      prisma.foodFeedback.findMany.mockResolvedValue([
        feedbackRow('r1', 5),
        feedbackRow('r2', 5),
        feedbackRow('r3', 5),
        feedbackRow('other-1', 1),
      ]);
      prisma.recipe.findMany.mockResolvedValue([
        { id: 'r1', title: 'Jollof Rice' },
        { id: 'r2', title: 'Jollof Rice' },
        { id: 'r3', title: 'Jollof Rice' },
        { id: 'other-1', title: 'Beans Porridge' },
      ]);

      const insight = await service.getInsightForDish('Jollof Rice');
      expect(insight!.cookCount).toBe(3);
      expect(insight!.avgRating).toBe(5);
    });

    it('surfaces a topIssue only once it hits both the cook-count AND share thresholds', async () => {
      // 4 cooks total; 2 tag timings_off (2/4 = 50% >= 25%, 2 >= MIN_ISSUE_COOKS) => surfaced
      prisma.foodFeedback.findMany.mockResolvedValue([
        feedbackRow('r1', 3, ['timings_off']),
        feedbackRow('r2', 3, ['timings_off']),
        feedbackRow('r3', 4, []),
        feedbackRow('r4', 4, []),
      ]);
      prisma.recipe.findMany.mockResolvedValue([
        { id: 'r1', title: 'Egusi Soup' },
        { id: 'r2', title: 'Egusi Soup' },
        { id: 'r3', title: 'Egusi Soup' },
        { id: 'r4', title: 'Egusi Soup' },
      ]);

      const insight = await service.getInsightForDish('Egusi Soup');
      expect(insight!.topIssues).toContain("step timings didn't match reality");
    });

    it('does not surface an issue tagged by only 1 cook, even if that is a large share', async () => {
      prisma.foodFeedback.findMany.mockResolvedValue([
        feedbackRow('r1', 3, ['timings_off']),
        feedbackRow('r2', 4, []),
        feedbackRow('r3', 4, []),
      ]);
      prisma.recipe.findMany.mockResolvedValue([
        { id: 'r1', title: 'Egusi Soup' },
        { id: 'r2', title: 'Egusi Soup' },
        { id: 'r3', title: 'Egusi Soup' },
      ]);

      const insight = await service.getInsightForDish('Egusi Soup');
      expect(insight!.topIssues).toEqual([]);
    });

    it('includes a corroborating comment as a notable note, de-identified and truncated', async () => {
      const longComment = `The timer was off and it took way longer than stated ${'x'.repeat(200)}`;
      prisma.foodFeedback.findMany.mockResolvedValue([
        feedbackRow('r1', 3, ['timings_off'], longComment),
        feedbackRow('r2', 2, ['timings_off'], 'contact me at cook@example.com if you want tips'),
        feedbackRow('r3', 4, []),
      ]);
      prisma.recipe.findMany.mockResolvedValue([
        { id: 'r1', title: 'Egusi Soup' },
        { id: 'r2', title: 'Egusi Soup' },
        { id: 'r3', title: 'Egusi Soup' },
      ]);

      const insight = await service.getInsightForDish('Egusi Soup');
      expect(insight!.notableNotes.length).toBeGreaterThan(0);
      expect(insight!.notableNotes[0].length).toBeLessThanOrEqual(140);
      const deidentified = insight!.notableNotes.find((n) => n.includes('contact me'));
      expect(deidentified).not.toContain('cook@example.com');
    });

    it('never surfaces a comment that neither corroborates an issue nor is low-rated', async () => {
      prisma.foodFeedback.findMany.mockResolvedValue([
        feedbackRow('r1', 5, [], 'I added extra garlic, was great!'),
        feedbackRow('r2', 4, []),
        feedbackRow('r3', 4, []),
      ]);
      prisma.recipe.findMany.mockResolvedValue([
        { id: 'r1', title: 'Egusi Soup' },
        { id: 'r2', title: 'Egusi Soup' },
        { id: 'r3', title: 'Egusi Soup' },
      ]);

      const insight = await service.getInsightForDish('Egusi Soup');
      expect(insight!.notableNotes).toEqual([]);
    });

    it('surfaces a low-rated comment even without a corroborated tag issue', async () => {
      prisma.foodFeedback.findMany.mockResolvedValue([
        feedbackRow('r1', 1, [], 'This just did not work for me at all'),
        feedbackRow('r2', 4, []),
        feedbackRow('r3', 4, []),
      ]);
      prisma.recipe.findMany.mockResolvedValue([
        { id: 'r1', title: 'Egusi Soup' },
        { id: 'r2', title: 'Egusi Soup' },
        { id: 'r3', title: 'Egusi Soup' },
      ]);

      const insight = await service.getInsightForDish('Egusi Soup');
      expect(insight!.notableNotes).toHaveLength(1);
    });

    it('caps notableNotes at 3 even when more qualify', async () => {
      prisma.foodFeedback.findMany.mockResolvedValue([
        feedbackRow('r1', 1, [], 'Comment one, quite bad'),
        feedbackRow('r2', 1, [], 'Comment two, quite bad'),
        feedbackRow('r3', 1, [], 'Comment three, quite bad'),
        feedbackRow('r4', 1, [], 'Comment four, quite bad'),
      ]);
      prisma.recipe.findMany.mockResolvedValue([
        { id: 'r1', title: 'Egusi Soup' },
        { id: 'r2', title: 'Egusi Soup' },
        { id: 'r3', title: 'Egusi Soup' },
        { id: 'r4', title: 'Egusi Soup' },
      ]);

      const insight = await service.getInsightForDish('Egusi Soup');
      expect(insight!.notableNotes.length).toBeLessThanOrEqual(3);
    });

    it('resolves to null (not a throw) when the prisma query rejects', async () => {
      prisma.foodFeedback.findMany.mockRejectedValue(new Error('db down'));
      const insight = await service.getInsightForDish('Egusi Soup');
      expect(insight).toBeNull();
    });
  });

  describe('getPromptNote', () => {
    it('returns null when there is no insight yet', async () => {
      const note = await service.getPromptNote('Brand New Dish');
      expect(note).toBeNull();
    });

    it('returns a bounded, style-guidance-only sentence when issues exist', async () => {
      prisma.foodFeedback.findMany.mockResolvedValue([
        feedbackRow('r1', 3, ['timings_off']),
        feedbackRow('r2', 3, ['timings_off']),
        feedbackRow('r3', 4, []),
      ]);
      prisma.recipe.findMany.mockResolvedValue([
        { id: 'r1', title: 'Egusi Soup' },
        { id: 'r2', title: 'Egusi Soup' },
        { id: 'r3', title: 'Egusi Soup' },
      ]);

      const note = await service.getPromptNote('Egusi Soup');
      expect(note).not.toBeNull();
      expect(note!.length).toBeLessThanOrEqual(400);
      expect(note).toMatch(/made a similar dish before/);
    });
  });

  describe('getGeneralGuidance', () => {
    it('returns null below the minimum-cooks threshold', async () => {
      prisma.foodFeedback.findMany.mockResolvedValue([feedbackRow('r1', 3, ['timings_off'])]);
      const note = await service.getGeneralGuidance();
      expect(note).toBeNull();
    });

    it('aggregates across all recent cooks regardless of dish', async () => {
      prisma.foodFeedback.findMany.mockResolvedValue([
        feedbackRow('r1', 3, ['quantities_off']),
        feedbackRow('r2', 3, ['quantities_off']),
        feedbackRow('r3', 4, []),
      ]);

      const note = await service.getGeneralGuidance();
      expect(note).not.toBeNull();
      expect(note).toMatch(/have cooked with FoodPadi recently/);
      expect(prisma.recipe.findMany).not.toHaveBeenCalled();
    });
  });
});
