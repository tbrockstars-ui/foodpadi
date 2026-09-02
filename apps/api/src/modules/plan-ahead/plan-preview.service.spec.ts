import { PlanAheadService } from './plan-ahead.service';
import { ClaudeService } from '../ai/claude.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AnalyticsService } from '../analytics/analytics.service';
import type { AuthenticatedActor, GuestActor } from '../auth/guest-or-auth.guard';

const GUEST: GuestActor = { type: 'guest', sessionId: 'g-1', disclaimerAcknowledged: true };
const USER: AuthenticatedActor = { type: 'user', userId: 'u-1', email: 'u1@example.com' };

describe('PlanAheadService.preview — AI-free guest Plan Ahead', () => {
  let claude: { generatePlanMeals: jest.Mock; generateCookTodayRecipes: jest.Mock };
  let prisma: Record<string, unknown>;
  let analytics: { track: jest.Mock };
  let service: PlanAheadService;

  beforeEach(() => {
    claude = { generatePlanMeals: jest.fn(), generateCookTodayRecipes: jest.fn() };
    prisma = {};
    analytics = { track: jest.fn() };
    service = new PlanAheadService(
      claude as unknown as ClaudeService,
      prisma as unknown as PrismaService,
      analytics as unknown as AnalyticsService,
    );
  });

  it('returns exactly `days` curated day-recipes and never calls ClaudeService', async () => {
    const res = await service.preview(3, GUEST);
    expect(res.days).toHaveLength(3);
    expect(res.days[0]).toMatchObject({ dayIndex: 0 });
    expect(res.days[0].recipe).toHaveProperty('title');
    expect(claude.generatePlanMeals).not.toHaveBeenCalled();
    expect(claude.generateCookTodayRecipes).not.toHaveBeenCalled();
  });

  it('clamps the day count to 1..7', async () => {
    expect((await service.preview(0, GUEST)).days.length).toBeGreaterThanOrEqual(1);
    expect((await service.preview(99, GUEST)).days).toHaveLength(7);
  });

  it('does not persist anything (no prisma access)', async () => {
    await service.preview(3, GUEST);
    // prisma is an empty object — any property access in the method would throw.
    expect(true).toBe(true);
  });

  it('tags the analytics event with guest status', async () => {
    await service.preview(2, GUEST);
    expect(analytics.track).toHaveBeenCalledWith(
      'plan_preview_generated',
      { guestSessionId: 'g-1' },
      expect.objectContaining({ days: 2, guest: true }),
    );

    analytics.track.mockClear();
    await service.preview(2, USER);
    expect(analytics.track).toHaveBeenCalledWith(
      'plan_preview_generated',
      { userId: 'u-1' },
      expect.objectContaining({ guest: false }),
    );
  });
});
