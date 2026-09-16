import { PlanAheadService } from './plan-ahead.service';
import { ClaudeService } from '../ai/claude.service';
import { AiAccessService } from '../ai/ai-access.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { EntitlementService } from '../billing/entitlement.service';
import { CookingInsightsService } from '../feedback/cooking-insights.service';
import type { AuthenticatedActor, GuestActor } from '../auth/guest-or-auth.guard';

const GUEST: GuestActor = { type: 'guest', sessionId: 'g-1', disclaimerAcknowledged: true };
const USER: AuthenticatedActor = { type: 'user', userId: 'u-1', email: 'u1@example.com' };

describe('PlanAheadService.preview — AI-free guest Plan Ahead', () => {
  let claude: { generatePlanMeals: jest.Mock; generateCookTodayRecipes: jest.Mock };
  let prisma: Record<string, unknown>;
  let analytics: { track: jest.Mock };
  let entitlements: { getUserEntitlement: jest.Mock };
  let service: PlanAheadService;

  beforeEach(() => {
    claude = { generatePlanMeals: jest.fn(), generateCookTodayRecipes: jest.fn() };
    prisma = {};
    analytics = { track: jest.fn() };
    // Defaults to 'trial' — same 1-day cap as a guest (user instruction
    // 2026-09-12: only a 'paid' entitlement unlocks more than one day).
    // Individual tests override this to exercise the 'paid' path.
    entitlements = { getUserEntitlement: jest.fn().mockResolvedValue('trial') };
    service = new PlanAheadService(
      claude as unknown as ClaudeService,
      prisma as unknown as PrismaService,
      analytics as unknown as AnalyticsService,
      { assertCanUseAi: jest.fn().mockResolvedValue(undefined) } as unknown as AiAccessService,
      entitlements as unknown as EntitlementService,
      {} as unknown as CookingInsightsService,
    );
  });

  it('returns exactly `days` curated day-recipes and never calls ClaudeService (paid user)', async () => {
    entitlements.getUserEntitlement.mockResolvedValue('paid');
    const res = await service.preview(3, USER);
    expect(res.days).toHaveLength(3);
    expect(res.days[0]).toMatchObject({ dayIndex: 0 });
    expect(res.days[0].recipe).toHaveProperty('title');
    expect(claude.generatePlanMeals).not.toHaveBeenCalled();
    expect(claude.generateCookTodayRecipes).not.toHaveBeenCalled();
  });

  it('clamps a paid user\'s day count to 1..7', async () => {
    entitlements.getUserEntitlement.mockResolvedValue('paid');
    expect((await service.preview(0, USER)).days.length).toBeGreaterThanOrEqual(1);
    expect((await service.preview(99, USER)).days).toHaveLength(7);
  });

  // Guest / trial — Plan Ahead's more-than-one-day scopes are Premium-only
  // (user instruction 2026-09-12); preview() caps both to a single day
  // regardless of how many were requested.
  it('caps a guest to a single day, however many were requested', async () => {
    expect((await service.preview(1, GUEST)).days).toHaveLength(1);
    expect((await service.preview(7, GUEST)).days).toHaveLength(1);
    expect((await service.preview(99, GUEST)).days).toHaveLength(1);
  });

  it('caps a non-paid registered user to a single day too', async () => {
    entitlements.getUserEntitlement.mockResolvedValue('guest'); // trial ended
    expect((await service.preview(7, USER)).days).toHaveLength(1);
  });

  it('does not persist anything (no prisma access)', async () => {
    await service.preview(1, GUEST);
    // prisma is an empty object — any property access in the method would throw.
    expect(true).toBe(true);
  });

  it('tags the analytics event with guest status', async () => {
    await service.preview(1, GUEST);
    expect(analytics.track).toHaveBeenCalledWith(
      'plan_preview_generated',
      { guestSessionId: 'g-1' },
      expect.objectContaining({ days: 1, guest: true }),
    );

    analytics.track.mockClear();
    entitlements.getUserEntitlement.mockResolvedValue('paid');
    await service.preview(2, USER);
    expect(analytics.track).toHaveBeenCalledWith(
      'plan_preview_generated',
      { userId: 'u-1' },
      expect.objectContaining({ guest: false }),
    );
  });
});
