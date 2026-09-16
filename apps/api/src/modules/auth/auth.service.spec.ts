import { AuthService } from './auth.service';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { MailerService } from '../../common/mailer.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { ReferralsService } from '../referrals/referrals.service';
import { EntitlementService } from '../billing/entitlement.service';
import { BillingConfigService } from '../billing/billing-config.service';

/**
 * Focused coverage for the Guest/Trial/Paid change only: a new signup must
 * open a 7-day in-app trial, emit `trial_started`, and report `entitlement:
 * 'trial'` on the auth response. The rest of AuthService is exercised by the
 * e2e/HTTP tests.
 */
describe('AuthService — trial starts on signup', () => {
  function build() {
    const created: any = {};
    const prisma: any = {
      user: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation(({ data }: any) => {
          created.profileCreate = data.profile.create;
          return Promise.resolve({
            id: 'u-new',
            email: data.email,
            profile: {
              displayName: data.profile.create.displayName ?? null,
              countryCode: data.profile.create.countryCode ?? null,
              onboardingCompletedAt: null,
              disclaimerAcknowledgedAt: null,
              trialEndsAt: data.profile.create.trialEndsAt ?? null,
            },
          });
        }),
      },
      refreshToken: { create: jest.fn().mockResolvedValue({}) },
    };
    const jwt = { sign: jest.fn().mockReturnValue('access.jwt') } as unknown as JwtService;
    const analytics = { track: jest.fn() };
    const referrals = { attributeOnRegister: jest.fn().mockResolvedValue({ attributed: false }) };
    const entitlements = { getUserEntitlement: jest.fn().mockResolvedValue('trial') };
    const billingConfig = { getResolved: jest.fn().mockResolvedValue({ appTrialDays: 7 }) };

    const svc = new AuthService(
      prisma as unknown as PrismaService,
      jwt,
      {} as unknown as MailerService,
      referrals as unknown as ReferralsService,
      analytics as unknown as AnalyticsService,
      entitlements as unknown as EntitlementService,
      billingConfig as unknown as BillingConfigService,
    );
    return { svc, prisma, analytics, created };
  }

  it('sets trialStartedAt / trialEndsAt (~7 days out) and emits trial_started', async () => {
    const { svc, analytics, created } = build();
    const before = Date.now();

    const res = await svc.register({ email: 'new@example.com', password: 'password123' } as any);

    const { trialStartedAt, trialEndsAt } = created.profileCreate;
    expect(trialStartedAt).toBeInstanceOf(Date);
    expect(trialEndsAt).toBeInstanceOf(Date);
    const days = (trialEndsAt.getTime() - trialStartedAt.getTime()) / 86_400_000;
    expect(days).toBeCloseTo(7, 5);
    expect(trialStartedAt.getTime()).toBeGreaterThanOrEqual(before);

    expect(analytics.track).toHaveBeenCalledWith(
      'trial_started',
      { userId: 'u-new' },
      expect.objectContaining({ endsAt: expect.any(String) }),
    );
    expect(res.user.entitlement).toBe('trial');
    expect(res.user.trialEndsAt).toEqual(trialEndsAt.toISOString());
  });
});
