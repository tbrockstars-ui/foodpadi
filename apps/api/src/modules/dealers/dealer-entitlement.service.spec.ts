import { DealerEntitlementService } from './dealer-entitlement.service';
import { PrismaService } from '../../prisma/prisma.service';
import { BillingConfigService } from '../billing/billing-config.service';

function configStub(pastDueGraceDays = 3) {
  return {
    getResolved: jest.fn().mockResolvedValue({ pastDueGraceDays }),
  } as unknown as BillingConfigService;
}

function buildService(row: any, pastDueGraceDays = 3) {
  const prisma: any = {
    dealerSubscription: { findUnique: jest.fn().mockResolvedValue(row) },
  };
  return new DealerEntitlementService(prisma as unknown as PrismaService, configStub(pastDueGraceDays));
}

function sub(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'ds1',
    dealerId: 'd1',
    provider: 'stripe',
    stripeCustomerId: 'cus_1',
    stripeSubscriptionId: 'sub_1',
    status: 'active',
    plan: 'dealer_monthly',
    basePriceCents: 2900,
    baseCurrency: 'usd',
    billingInterval: 'month',
    currentPeriodEnd: new Date(Date.now() + 20 * 86_400_000),
    cancelAtPeriodEnd: false,
    canceledAt: null,
    trialEndsAt: null,
    ...overrides,
  };
}

describe('DealerEntitlementService.computeEntitlement', () => {
  const svc = buildService(null);
  const OLD_DEALER = process.env.DEALER_PAST_DUE_GRACE_DAYS;
  const OLD_STRIPE = process.env.STRIPE_PAST_DUE_GRACE_DAYS;
  afterEach(() => {
    for (const [k, v] of [
      ['DEALER_PAST_DUE_GRACE_DAYS', OLD_DEALER],
      ['STRIPE_PAST_DUE_GRACE_DAYS', OLD_STRIPE],
    ] as const) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  });

  it('no row → not active, status none', () => {
    expect(svc.computeEntitlement(null)).toEqual({ active: false, status: 'none' });
  });

  it.each(['active', 'trialing'])('%s → active', (status) => {
    expect(svc.computeEntitlement(sub({ status }) as any).active).toBe(true);
  });

  it.each(['canceled', 'incomplete', 'incomplete_expired', 'unpaid', 'paused'])(
    '%s → not active (listing removed from customer search — brief §25)',
    (status) => {
      expect(svc.computeEntitlement(sub({ status }) as any).active).toBe(false);
    },
  );

  it('cancel-at-period-end, period not yet ended → still active for the paid period', () => {
    const row = sub({ status: 'active', cancelAtPeriodEnd: true });
    expect(svc.computeEntitlement(row as any).active).toBe(true);
  });

  it('cancel-at-period-end, period has ended → not active', () => {
    const row = sub({
      status: 'active',
      cancelAtPeriodEnd: true,
      currentPeriodEnd: new Date(Date.now() - 86_400_000),
    });
    expect(svc.computeEntitlement(row as any).active).toBe(false);
  });

  describe('past_due grace window', () => {
    it('no grace arg, no env → grace 0 → not active', () => {
      delete process.env.DEALER_PAST_DUE_GRACE_DAYS;
      delete process.env.STRIPE_PAST_DUE_GRACE_DAYS;
      expect(svc.computeEntitlement(sub({ status: 'past_due' }) as any).active).toBe(false);
    });

    it('explicit grace arg — within the window → active', () => {
      delete process.env.DEALER_PAST_DUE_GRACE_DAYS;
      delete process.env.STRIPE_PAST_DUE_GRACE_DAYS;
      const row = sub({ status: 'past_due', currentPeriodEnd: new Date(Date.now() - 86_400_000) });
      expect(svc.computeEntitlement(row as any, 3).active).toBe(true);
    });

    it('explicit grace arg — past the window → not active', () => {
      const row = sub({ status: 'past_due', currentPeriodEnd: new Date(Date.now() - 5 * 86_400_000) });
      expect(svc.computeEntitlement(row as any, 3).active).toBe(false);
    });

    it('DEALER_PAST_DUE_GRACE_DAYS overrides the passed/default grace', () => {
      process.env.DEALER_PAST_DUE_GRACE_DAYS = '0';
      const row = sub({ status: 'past_due', currentPeriodEnd: new Date(Date.now() - 86_400_000) });
      expect(svc.computeEntitlement(row as any).active).toBe(false);
    });

    it('falls back to STRIPE_PAST_DUE_GRACE_DAYS when the dealer one is unset', () => {
      delete process.env.DEALER_PAST_DUE_GRACE_DAYS;
      process.env.STRIPE_PAST_DUE_GRACE_DAYS = '10';
      const row = sub({ status: 'past_due', currentPeriodEnd: new Date(Date.now() - 3 * 86_400_000) });
      expect(svc.computeEntitlement(row as any).active).toBe(true);
    });
  });
});

describe('DealerEntitlementService.isActive', () => {
  const OLD_DEALER = process.env.DEALER_PAST_DUE_GRACE_DAYS;
  const OLD_STRIPE = process.env.STRIPE_PAST_DUE_GRACE_DAYS;
  afterEach(() => {
    if (OLD_DEALER === undefined) delete process.env.DEALER_PAST_DUE_GRACE_DAYS;
    else process.env.DEALER_PAST_DUE_GRACE_DAYS = OLD_DEALER;
    if (OLD_STRIPE === undefined) delete process.env.STRIPE_PAST_DUE_GRACE_DAYS;
    else process.env.STRIPE_PAST_DUE_GRACE_DAYS = OLD_STRIPE;
  });

  it('reads the row and applies the rule', async () => {
    await expect(buildService(sub({ status: 'active' })).isActive('d1')).resolves.toBe(true);
    await expect(buildService(sub({ status: 'canceled' })).isActive('d1')).resolves.toBe(false);
  });

  it('uses the admin billing_config grace when no env override is set', async () => {
    delete process.env.DEALER_PAST_DUE_GRACE_DAYS;
    delete process.env.STRIPE_PAST_DUE_GRACE_DAYS;
    const row = sub({ status: 'past_due', currentPeriodEnd: new Date(Date.now() - 2 * 86_400_000) });
    await expect(buildService(row, 3).isActive('d1')).resolves.toBe(true);
    await expect(buildService(row, 1).isActive('d1')).resolves.toBe(false);
  });
});
