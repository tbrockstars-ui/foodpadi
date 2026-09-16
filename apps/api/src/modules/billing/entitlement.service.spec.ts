import { EntitlementService } from './entitlement.service';
import { PrismaService } from '../../prisma/prisma.service';
import { BillingConfigService } from './billing-config.service';

/** BillingConfigService stub — only `getResolved().pastDueGraceDays` is read. */
function configStub(pastDueGraceDays = 3) {
  return { getResolved: jest.fn().mockResolvedValue({ pastDueGraceDays }) } as unknown as BillingConfigService;
}

function buildService(row: any, pastDueGraceDays = 3) {
  const prisma: any = {
    subscription: { findUnique: jest.fn().mockResolvedValue(row) },
  };
  return new EntitlementService(prisma as unknown as PrismaService, configStub(pastDueGraceDays));
}

function sub(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 's1',
    userId: 'u1',
    stripeCustomerId: 'cus_1',
    stripeSubscriptionId: 'sub_1',
    stripePriceId: 'price_1',
    status: 'active',
    basePriceCents: 499,
    baseCurrency: 'usd',
    billingInterval: 'month',
    presentmentAmountCents: null,
    presentmentCurrency: null,
    customerCountry: null,
    currentPeriodEnd: new Date(Date.now() + 20 * 86_400_000),
    cancelAtPeriodEnd: false,
    canceledAt: null,
    trialEndsAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('EntitlementService.computeEntitlement', () => {
  const svc = buildService(null);

  it('no row → not premium, status none', () => {
    expect(svc.computeEntitlement(null)).toEqual({ premium: false, status: 'none' });
  });

  it.each(['active', 'trialing'])('%s → premium', (status) => {
    expect(svc.computeEntitlement(sub({ status }) as any).premium).toBe(true);
  });

  it.each(['canceled', 'incomplete', 'incomplete_expired', 'unpaid', 'paused'])(
    '%s → not premium',
    (status) => {
      expect(svc.computeEntitlement(sub({ status }) as any).premium).toBe(false);
    },
  );

  it('cancel-at-period-end still active → stays premium until the period ends', () => {
    const row = sub({ status: 'active', cancelAtPeriodEnd: true });
    expect(svc.computeEntitlement(row as any).premium).toBe(true);
  });

  describe('past_due', () => {
    const OLD = process.env.STRIPE_PAST_DUE_GRACE_DAYS;
    afterEach(() => {
      if (OLD === undefined) delete process.env.STRIPE_PAST_DUE_GRACE_DAYS;
      else process.env.STRIPE_PAST_DUE_GRACE_DAYS = OLD;
    });

    it('pure computeEntitlement with no grace arg and no env → grace 0 → not premium', () => {
      delete process.env.STRIPE_PAST_DUE_GRACE_DAYS;
      expect(svc.computeEntitlement(sub({ status: 'past_due' }) as any).premium).toBe(false);
    });

    it('explicit grace arg — within the window → premium', () => {
      delete process.env.STRIPE_PAST_DUE_GRACE_DAYS;
      const row = sub({ status: 'past_due', currentPeriodEnd: new Date(Date.now() - 86_400_000) });
      expect(svc.computeEntitlement(row as any, 3).premium).toBe(true);
    });

    it('explicit grace arg — past the window → not premium', () => {
      const row = sub({ status: 'past_due', currentPeriodEnd: new Date(Date.now() - 5 * 86_400_000) });
      expect(svc.computeEntitlement(row as any, 3).premium).toBe(false);
    });

    it('env var overrides the passed/default grace', () => {
      process.env.STRIPE_PAST_DUE_GRACE_DAYS = '0';
      const row = sub({ status: 'past_due', currentPeriodEnd: new Date(Date.now() - 86_400_000) });
      // grace arg omitted → env (0) wins → not premium even 1 day in
      expect(svc.computeEntitlement(row as any).premium).toBe(false);
    });

    it('async isPremium uses the admin config grace when env is unset', async () => {
      delete process.env.STRIPE_PAST_DUE_GRACE_DAYS;
      const row = sub({ status: 'past_due', currentPeriodEnd: new Date(Date.now() - 2 * 86_400_000) });
      // config grace 3 → still inside → premium; config grace 1 → outside → not
      await expect(buildService(row, 3).isPremium('u1')).resolves.toBe(true);
      await expect(buildService(row, 1).isPremium('u1')).resolves.toBe(false);
    });
  });
});

describe('EntitlementService.getSubscriptionView', () => {
  it('applies the grace window to the client view (past_due inside grace → premium)', async () => {
    delete process.env.STRIPE_PAST_DUE_GRACE_DAYS;
    const row = sub({ status: 'past_due', currentPeriodEnd: new Date(Date.now() - 86_400_000) });
    const v = await buildService(row, 5).getSubscriptionView('u1');
    expect(v).toMatchObject({ premium: true, plan: 'premium', status: 'past_due' });
  });

  it('past the grace window → not premium in the view', async () => {
    delete process.env.STRIPE_PAST_DUE_GRACE_DAYS;
    const row = sub({ status: 'past_due', currentPeriodEnd: new Date(Date.now() - 10 * 86_400_000) });
    const v = await buildService(row, 3).getSubscriptionView('u1');
    expect(v).toMatchObject({ premium: false, plan: 'free', status: 'past_due' });
  });
});

describe('EntitlementService.toView', () => {
  const svc = buildService(null);

  it('free user (no row)', () => {
    const v = svc.toView(null);
    expect(v).toMatchObject({
      premium: false,
      plan: 'free',
      status: 'none',
      base: { amountCents: 499, currency: 'usd' },
      presentment: null,
      canManage: false,
    });
  });

  it('never overwrites the canonical base price with the localized amount', () => {
    const row = sub({ presentmentAmountCents: 44900, presentmentCurrency: 'ngn' });
    const v = svc.toView(row as any);
    expect(v.base).toEqual({ amountCents: 499, currency: 'usd' });
    expect(v.presentment).toEqual({ amountCents: 44900, currency: 'ngn' });
  });

  it('exposes portal availability once a Stripe customer exists', () => {
    expect(svc.toView(sub() as any).canManage).toBe(true);
    expect(svc.toView(sub({ stripeCustomerId: null }) as any).canManage).toBe(false);
  });

  it('defaults a free user to the stripe provider', () => {
    expect(svc.toView(null).provider).toBe('stripe');
  });

  it('a Flutterwave sub is cancellable in-app, not portal-managed', () => {
    const row = sub({
      provider: 'flutterwave',
      status: 'active',
      stripeCustomerId: null,
      flwSubscriptionId: '555',
      currentPeriodEnd: new Date(Date.now() + 10 * 86_400_000),
    });
    const v = svc.toView(row as any);
    expect(v.provider).toBe('flutterwave');
    expect(v.canManage).toBe(false);
    expect(v.canCancel).toBe(true);
  });

  it('a Flutterwave sub already cancelling is not offered cancel again', () => {
    const row = sub({
      provider: 'flutterwave',
      status: 'active',
      flwSubscriptionId: '555',
      cancelAtPeriodEnd: true,
      currentPeriodEnd: new Date(Date.now() + 5 * 86_400_000),
    });
    expect(svc.toView(row as any).canCancel).toBe(false);
  });
});

describe('EntitlementService.isPremium', () => {
  it('reads the row and applies the rule', async () => {
    const svc = buildService(sub({ status: 'active' }));
    await expect(svc.isPremium('u1')).resolves.toBe(true);
  });
});

describe('EntitlementService.getUserEntitlement (Guest/Trial/Paid)', () => {
  function build({ subscription = null, trialEndsAt = null }: { subscription?: any; trialEndsAt?: Date | null }) {
    const prisma: any = {
      subscription: { findUnique: jest.fn().mockResolvedValue(subscription) },
      userProfile: { findUnique: jest.fn().mockResolvedValue(trialEndsAt ? { trialEndsAt } : { trialEndsAt: null }) },
    };
    return new EntitlementService(prisma as unknown as PrismaService, configStub());
  }

  it('active subscription → paid (trial fields ignored)', async () => {
    const svc = build({ subscription: sub({ status: 'active' }), trialEndsAt: new Date(Date.now() + 5 * 86_400_000) });
    await expect(svc.getUserEntitlement('u1')).resolves.toBe('paid');
  });

  it('no subscription, trial still in the future → trial', async () => {
    const svc = build({ trialEndsAt: new Date(Date.now() + 3 * 86_400_000) });
    await expect(svc.getUserEntitlement('u1')).resolves.toBe('trial');
  });

  it('no subscription, trial expired → guest', async () => {
    const svc = build({ trialEndsAt: new Date(Date.now() - 60_000) });
    await expect(svc.getUserEntitlement('u1')).resolves.toBe('guest');
  });

  it('no subscription, never had a trial → guest', async () => {
    const svc = build({ trialEndsAt: null });
    await expect(svc.getUserEntitlement('u1')).resolves.toBe('guest');
  });

  it('lapsed subscription (canceled) with an expired trial → guest', async () => {
    const svc = build({ subscription: sub({ status: 'canceled' }), trialEndsAt: new Date(Date.now() - 86_400_000) });
    await expect(svc.getUserEntitlement('u1')).resolves.toBe('guest');
  });
});
