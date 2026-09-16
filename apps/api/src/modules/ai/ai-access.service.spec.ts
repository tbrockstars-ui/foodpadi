import { HttpException } from '@nestjs/common';
import { AiAccessService } from './ai-access.service';
import { EntitlementService } from '../billing/entitlement.service';
import { BillingConfigService } from '../billing/billing-config.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AnalyticsService } from '../analytics/analytics.service';

function build({
  entitlement,
  trialAiLimit = 20,
  usedAfterIncrement,
}: {
  entitlement: 'guest' | 'trial' | 'paid';
  trialAiLimit?: number;
  usedAfterIncrement?: number;
}) {
  const entitlements = { getUserEntitlement: jest.fn().mockResolvedValue(entitlement) };
  const billingConfig = { getResolved: jest.fn().mockResolvedValue({ trialAiLimit }) };
  const prisma: any = {
    userProfile: {
      update: jest.fn().mockResolvedValue({ trialAiUsedCount: usedAfterIncrement ?? 1 }),
    },
  };
  const analytics = { track: jest.fn() };
  const svc = new AiAccessService(
    entitlements as unknown as EntitlementService,
    billingConfig as unknown as BillingConfigService,
    prisma as unknown as PrismaService,
    analytics as unknown as AnalyticsService,
  );
  return { svc, entitlements, billingConfig, prisma, analytics };
}

describe('AiAccessService.assertCanUseAi', () => {
  it('paid → allowed, no counter touched', async () => {
    const { svc, prisma } = build({ entitlement: 'paid' });
    await expect(svc.assertCanUseAi('u1', 'cook_today')).resolves.toBeUndefined();
    expect(prisma.userProfile.update).not.toHaveBeenCalled();
  });

  it('guest (registered, trial over) → 402 AI_ACCESS_DENIED, no counter touched', async () => {
    const { svc, prisma, analytics } = build({ entitlement: 'guest' });
    await expect(svc.assertCanUseAi('u1', 'scan_photo')).rejects.toMatchObject({
      status: 402,
      response: { code: 'AI_ACCESS_DENIED', reason: 'GUEST' },
    });
    expect(prisma.userProfile.update).not.toHaveBeenCalled();
    expect(analytics.track).toHaveBeenCalledWith('guest_ai_blocked', { userId: 'u1' }, { feature: 'scan_photo' });
  });

  it('trial under the limit → allowed, counter incremented, trial_ai_used tracked', async () => {
    const { svc, prisma, analytics } = build({ entitlement: 'trial', trialAiLimit: 20, usedAfterIncrement: 5 });
    await expect(svc.assertCanUseAi('u1', 'cook_today')).resolves.toBeUndefined();
    expect(prisma.userProfile.update).toHaveBeenCalledWith({
      where: { userId: 'u1' },
      data: { trialAiUsedCount: { increment: 1 } },
      select: { trialAiUsedCount: true },
    });
    expect(analytics.track).toHaveBeenCalledWith(
      'trial_ai_used',
      { userId: 'u1' },
      { feature: 'cook_today', used: 5, limit: 20 },
    );
  });

  it('trial at the limit → 402 AI_TRIAL_LIMIT_REACHED', async () => {
    const { svc, analytics } = build({ entitlement: 'trial', trialAiLimit: 20, usedAfterIncrement: 21 });
    await expect(svc.assertCanUseAi('u1', 'plan_ahead_generate')).rejects.toMatchObject({
      status: 402,
      response: { code: 'AI_TRIAL_LIMIT_REACHED' },
    });
    expect(analytics.track).toHaveBeenCalledWith(
      'trial_ai_limit_reached',
      { userId: 'u1' },
      { feature: 'plan_ahead_generate', limit: 20 },
    );
  });

  it('the thrown error is an HttpException (so Nest serialises it, not a 500)', async () => {
    const { svc } = build({ entitlement: 'guest' });
    await expect(svc.assertCanUseAi('u1', 'x')).rejects.toBeInstanceOf(HttpException);
  });
});
