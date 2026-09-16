import { HttpException, HttpStatus } from '@nestjs/common';
import { PlanAheadService } from './plan-ahead.service';
import { ClaudeService } from '../ai/claude.service';
import { AiAccessService } from '../ai/ai-access.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { EntitlementService } from '../billing/entitlement.service';
import { CookingInsightsService } from '../feedback/cooking-insights.service';
import type { GeneratePlanDto } from './dto/generate-plan.dto';

// generate()'s Premium gate (user instruction 2026-09-12): 'today'/'tomorrow'
// stay open to guest/trial, 'week'/'3day'/'custom' need a paid entitlement.
// Checked BEFORE assertCanUseAi so a blocked request never spends any of the
// caller's metered AI-call budget. Everything past the gate (loadPersonalisation
// onward) is exercised elsewhere — this only needs to prove the gate itself
// fires (or doesn't) correctly, so `assertCanUseAi` is mocked to reject with a
// sentinel once reached, letting the test stop right there.
describe('PlanAheadService.generate — Premium scope gate', () => {
  const PAST_GATE = new Error('__past_gate__');
  let entitlements: { getUserEntitlement: jest.Mock };
  let aiAccess: { assertCanUseAi: jest.Mock };
  let service: PlanAheadService;

  beforeEach(() => {
    entitlements = { getUserEntitlement: jest.fn() };
    aiAccess = { assertCanUseAi: jest.fn().mockRejectedValue(PAST_GATE) };
    service = new PlanAheadService(
      {} as unknown as ClaudeService,
      {} as unknown as PrismaService,
      { track: jest.fn() } as unknown as AnalyticsService,
      aiAccess as unknown as AiAccessService,
      entitlements as unknown as EntitlementService,
      {} as unknown as CookingInsightsService,
    );
  });

  const dto = (scope: GeneratePlanDto['scope'], customDays?: number): GeneratePlanDto =>
    ({ scope, customDays }) as GeneratePlanDto;

  it.each(['week', '3day', 'custom'] as const)(
    'rejects a trial user\'s "%s" scope without ever calling assertCanUseAi',
    async (scope) => {
      entitlements.getUserEntitlement.mockResolvedValue('trial');
      await expect(service.generate(dto(scope, 5), 'u-1')).rejects.toMatchObject({
        status: HttpStatus.PAYMENT_REQUIRED,
        response: expect.objectContaining({ code: 'PLAN_SCOPE_REQUIRES_PREMIUM' }),
      });
      expect(aiAccess.assertCanUseAi).not.toHaveBeenCalled();
    },
  );

  it('rejects a guest-entitlement (trial-ended) user the same way', async () => {
    entitlements.getUserEntitlement.mockResolvedValue('guest');
    await expect(service.generate(dto('week'), 'u-1')).rejects.toBeInstanceOf(HttpException);
    expect(aiAccess.assertCanUseAi).not.toHaveBeenCalled();
  });

  it.each(['today', 'tomorrow'] as const)(
    'never checks entitlement for the always-open "%s" scope',
    async (scope) => {
      await expect(service.generate(dto(scope), 'u-1')).rejects.toBe(PAST_GATE);
      expect(entitlements.getUserEntitlement).not.toHaveBeenCalled();
      expect(aiAccess.assertCanUseAi).toHaveBeenCalledWith('u-1', 'plan_ahead_generate');
    },
  );

  it.each(['week', '3day', 'custom'] as const)('lets a paid user through to "%s"', async (scope) => {
    entitlements.getUserEntitlement.mockResolvedValue('paid');
    await expect(service.generate(dto(scope, 10), 'u-1')).rejects.toBe(PAST_GATE);
    expect(aiAccess.assertCanUseAi).toHaveBeenCalledWith('u-1', 'plan_ahead_generate');
  });
});
