import { Prisma } from '@prisma/client';
import { BillingService } from './billing.service';
import { EntitlementService } from './entitlement.service';
import { PrismaService } from '../../prisma/prisma.service';
import { StripeService } from './stripe.service';
import { FlutterwaveService } from './flutterwave.service';
import { BillingConfigService } from './billing-config.service';
import { FxRateService } from './fx-rate.service';

const DEFAULT_TEST_CONFIG = {
  basePriceCents: 499,
  baseCurrency: 'usd',
  billingInterval: 'month' as const,
  trialDays: 0,
  appTrialDays: 7,
  trialAiLimit: 20,
  pastDueGraceDays: 3,
  flwNgnAmount: 7500,
  currencyOptions: { gbp: 449, eur: 499, ngn: 750000 },
  stripePriceId: 'price_env',
  flwPlanId: null,
  updatedAt: null,
};

function build(configOverrides: Partial<typeof DEFAULT_TEST_CONFIG> = {}) {
  const rows = new Map<string, any>();

  const prisma: any = {
    subscription: {
      findUnique: jest.fn(({ where }: any) => {
        if (where.userId) return Promise.resolve(rows.get(where.userId) ?? null);
        const byField = [...rows.values()].find(
          (r) =>
            (where.stripeSubscriptionId && r.stripeSubscriptionId === where.stripeSubscriptionId) ||
            (where.stripeCustomerId && r.stripeCustomerId === where.stripeCustomerId) ||
            (where.flwSubscriptionId && r.flwSubscriptionId === where.flwSubscriptionId) ||
            (where.flwTxRef && r.flwTxRef === where.flwTxRef),
        );
        return Promise.resolve(byField ?? null);
      }),
      findFirst: jest.fn(({ where }: any) => {
        const match = [...rows.values()].find(
          (r) => where.flwCustomerEmail && r.flwCustomerEmail === where.flwCustomerEmail,
        );
        return Promise.resolve(match ?? null);
      }),
      upsert: jest.fn(({ where, create, update }: any) => {
        const existing = rows.get(where.userId);
        const next = existing ? { ...existing, ...update } : { userId: where.userId, ...create };
        rows.set(where.userId, next);
        return Promise.resolve(next);
      }),
      update: jest.fn(({ where, data }: any) => {
        const existing = rows.get(where.userId) ?? { userId: where.userId };
        const next = { ...existing, ...data };
        rows.set(where.userId, next);
        return Promise.resolve(next);
      }),
    },
    webhookEvent: {
      create: jest.fn(),
      delete: jest.fn().mockResolvedValue(undefined),
    },
    userProfile: {
      findUnique: jest.fn().mockResolvedValue({ countryCode: null }),
    },
  };

  const stripe: any = {
    isConfigured: true,
    webAppUrl: 'https://app.test',
    retrieveSubscription: jest.fn(),
    retrieveCheckoutSession: jest.fn(),
    getOrCreateCustomer: jest.fn().mockResolvedValue('cus_new'),
    createCheckoutSession: jest.fn().mockResolvedValue({ url: 'https://checkout.stripe.com/pay/xyz' }),
  };

  const flutterwave: any = {
    isConfigured: true,
    getPaymentPlan: jest.fn().mockResolvedValue({
      id: 999,
      name: 'FoodPadi Premium',
      amount: 7500,
      interval: 'monthly',
      currency: 'NGN',
      status: 'active',
    }),
    verifyTransaction: jest.fn(),
    findActiveSubscription: jest.fn().mockResolvedValue({ id: 555, plan: 999 }),
    cancelSubscription: jest.fn().mockResolvedValue(undefined),
    createPaymentLink: jest.fn().mockResolvedValue('https://checkout.flutterwave.com/pay/abc'),
  };

  const billingConfig: any = {
    getResolved: jest.fn().mockResolvedValue({ ...DEFAULT_TEST_CONFIG, ...configOverrides }),
    getView: jest.fn(),
    update: jest.fn(),
  };

  // Deterministic FX: 1 USD = 0.80 GBP / 0.90 EUR / 1600 NGN / 150 JPY.
  const fx: any = {
    getSnapshot: jest.fn().mockResolvedValue({
      baseCurrency: 'usd',
      rates: { gbp: 0.8, eur: 0.9, ngn: 1600, jpy: 150, usd: 1 },
      source: 'test',
      fetchedAt: new Date('2026-09-09T00:00:00Z'),
    }),
    refresh: jest.fn(),
    buildView: jest.fn(),
  };

  const entitlements = new EntitlementService(
    prisma as unknown as PrismaService,
    billingConfig as unknown as BillingConfigService,
  );
  const service = new BillingService(
    prisma as unknown as PrismaService,
    stripe as unknown as StripeService,
    flutterwave as unknown as FlutterwaveService,
    entitlements,
    billingConfig as unknown as BillingConfigService,
    fx as unknown as FxRateService,
  );
  return { service, prisma, stripe, flutterwave, billingConfig, fx, rows };
}

function stripeSub(overrides: Partial<Record<string, any>> = {}) {
  return {
    id: 'sub_1',
    status: 'active',
    customer: 'cus_1',
    cancel_at_period_end: false,
    canceled_at: null,
    trial_end: null,
    current_period_end: Math.floor(Date.now() / 1000) + 20 * 86_400,
    items: { data: [{ price: { id: 'price_1' } }] },
    metadata: { foodpadiUserId: 'u1' },
    ...overrides,
  };
}

function uniqueViolation() {
  return new Prisma.PrismaClientKnownRequestError('duplicate', {
    code: 'P2002',
    clientVersion: 'test',
  });
}

describe('BillingService webhook idempotency', () => {
  it('processes an event once and skips a duplicate delivery', async () => {
    const { service, prisma, stripe, rows } = build();
    stripe.retrieveSubscription.mockResolvedValue(stripeSub());

    const event: any = {
      id: 'evt_1',
      type: 'checkout.session.completed',
      data: { object: { id: 'cs_1', client_reference_id: 'u1', customer: 'cus_1', subscription: 'sub_1' } },
    };

    // First delivery — ledger insert succeeds, handler runs.
    prisma.webhookEvent.create.mockResolvedValueOnce({ id: 'evt_1' });
    await service.handleWebhookEvent(event);
    expect(rows.get('u1')).toMatchObject({ status: 'active', stripeSubscriptionId: 'sub_1' });
    expect(stripe.retrieveSubscription).toHaveBeenCalledTimes(1);

    // Second (duplicate) delivery — ledger insert conflicts, handler must NOT run again.
    prisma.webhookEvent.create.mockRejectedValueOnce(uniqueViolation());
    await service.handleWebhookEvent(event);
    expect(stripe.retrieveSubscription).toHaveBeenCalledTimes(1);
  });

  it('rolls back the ledger row when a handler throws so Stripe can retry', async () => {
    const { service, prisma, stripe } = build();
    prisma.webhookEvent.create.mockResolvedValue({ id: 'evt_x' });
    stripe.retrieveSubscription.mockRejectedValue(new Error('stripe down'));

    const event: any = {
      id: 'evt_x',
      type: 'checkout.session.completed',
      data: { object: { id: 'cs_x', client_reference_id: 'u1', customer: 'cus_1', subscription: 'sub_1' } },
    };

    await expect(service.handleWebhookEvent(event)).rejects.toThrow('stripe down');
    expect(prisma.webhookEvent.delete).toHaveBeenCalledWith({ where: { id: 'stripe:evt_x' } });
  });
});

describe('BillingService subscription lifecycle', () => {
  it('customer.subscription.updated syncs status, period end and cancel flag', async () => {
    const { service, prisma, rows } = build();
    prisma.webhookEvent.create.mockResolvedValue({ id: 'evt_2' });

    await service.handleWebhookEvent({
      id: 'evt_2',
      type: 'customer.subscription.updated',
      data: { object: stripeSub({ status: 'active', cancel_at_period_end: true }) },
    } as any);

    expect(rows.get('u1')).toMatchObject({
      status: 'active',
      cancelAtPeriodEnd: true,
      stripePriceId: 'price_1',
    });
  });

  it('customer.subscription.deleted marks the row canceled', async () => {
    const { service, prisma, rows } = build();
    prisma.webhookEvent.create.mockResolvedValue({ id: 'evt_3' });

    await service.handleWebhookEvent({
      id: 'evt_3',
      type: 'customer.subscription.deleted',
      data: { object: stripeSub({ status: 'canceled' }) },
    } as any);

    expect(rows.get('u1').status).toBe('canceled');
  });
});

describe('BillingService invoice handling', () => {
  it('invoice.paid records the real charged amount/currency without touching the base price', async () => {
    const { service, prisma, stripe, rows } = build();
    // Pre-existing linked row.
    rows.set('u1', {
      userId: 'u1',
      stripeSubscriptionId: 'sub_1',
      stripeCustomerId: 'cus_1',
      basePriceCents: 499,
      baseCurrency: 'usd',
      status: 'active',
    });
    prisma.webhookEvent.create.mockResolvedValue({ id: 'evt_4' });
    stripe.retrieveSubscription.mockResolvedValue(stripeSub());

    await service.handleWebhookEvent({
      id: 'evt_4',
      type: 'invoice.paid',
      data: {
        object: {
          id: 'in_1',
          subscription: 'sub_1',
          customer: 'cus_1',
          amount_paid: 449,
          currency: 'gbp',
          customer_address: { country: 'GB' },
        },
      },
    } as any);

    const row = rows.get('u1');
    expect(row.basePriceCents).toBe(499);
    expect(row.baseCurrency).toBe('usd');
    expect(row.presentmentAmountCents).toBe(449);
    expect(row.presentmentCurrency).toBe('gbp');
    expect(row.customerCountry).toBe('GB');
  });

  it('invoice.payment_failed leaves the row not-premium', async () => {
    const { service, prisma, stripe, rows } = build();
    rows.set('u1', { userId: 'u1', stripeSubscriptionId: 'sub_1', stripeCustomerId: 'cus_1', status: 'active' });
    prisma.webhookEvent.create.mockResolvedValue({ id: 'evt_5' });
    stripe.retrieveSubscription.mockResolvedValue(stripeSub({ status: 'past_due' }));

    await service.handleWebhookEvent({
      id: 'evt_5',
      type: 'invoice.payment_failed',
      data: { object: { id: 'in_2', subscription: 'sub_1', customer: 'cus_1', currency: 'usd' } },
    } as any);

    expect(rows.get('u1').status).toBe('past_due');
  });
});

describe('BillingService.syncCheckoutSession', () => {
  it('activates premium from a paid session and reports justActivated once', async () => {
    const { service, stripe, rows } = build();
    stripe.retrieveCheckoutSession.mockResolvedValue({
      id: 'cs_9',
      client_reference_id: 'u1',
      customer: 'cus_1',
      subscription: stripeSub(),
    });

    const first = await service.syncCheckoutSession({ userId: 'u1', email: 'a@b.com' }, { sessionId: 'cs_9' });
    expect(first.subscription.premium).toBe(true);
    expect(first.justActivated).toBe(true);
    expect(rows.get('u1').status).toBe('active');

    const second = await service.syncCheckoutSession({ userId: 'u1', email: 'a@b.com' }, { sessionId: 'cs_9' });
    expect(second.subscription.premium).toBe(true);
    expect(second.justActivated).toBe(false);
  });

  it('rejects a session that belongs to another user', async () => {
    const { service, stripe } = build();
    stripe.retrieveCheckoutSession.mockResolvedValue({
      id: 'cs_x',
      client_reference_id: 'someone_else',
      customer: 'cus_2',
      subscription: stripeSub({ metadata: { foodpadiUserId: 'someone_else' } }),
    });
    await expect(
      service.syncCheckoutSession({ userId: 'u1', email: 'a@b.com' }, { sessionId: 'cs_x' }),
    ).rejects.toThrow(/does not belong to you/);
  });

  it('does not grant premium when the session has no subscription yet', async () => {
    const { service, stripe, rows } = build();
    stripe.retrieveCheckoutSession.mockResolvedValue({
      id: 'cs_0',
      client_reference_id: 'u1',
      customer: 'cus_1',
      subscription: null,
    });
    const res = await service.syncCheckoutSession({ userId: 'u1', email: 'a@b.com' }, { sessionId: 'cs_0' });
    expect(res.subscription.premium).toBe(false);
    expect(res.justActivated).toBe(false);
    expect(rows.get('u1')).toBeUndefined();
  });
});

describe('BillingService.getPricing — daily FX estimate (Stripe path)', () => {
  it('converts the base price at the daily rate, not the admin currency_options value', async () => {
    const { service } = build(); // FX: 1 USD = 0.80 GBP; base = $4.99
    const p = await service.getPricing('GB');
    expect(p.provider).toBe('stripe');
    // 499 cents * 0.80 = 399 (NOT the currencyOptions 449)
    expect(p.local).toEqual({ amountCents: 399, currency: 'gbp' });
    expect(p.ratesUpdatedAt).toBe('2026-09-09T00:00:00.000Z');
  });

  it('handles zero-decimal target currencies (JPY = whole yen)', async () => {
    const { service } = build(); // FX: 1 USD = 150 JPY
    const p = await service.getPricing('JP');
    // 4.99 USD * 150 = 748.5 -> 749 yen (whole units)
    expect(p.local).toEqual({ amountCents: 749, currency: 'jpy' });
  });

  it('falls back to the admin currency_options amount when the feed has no rate', async () => {
    const { service, fx } = build();
    fx.getSnapshot.mockResolvedValue({
      baseCurrency: 'usd',
      rates: { usd: 1 }, // no gbp
      source: 'test',
      fetchedAt: new Date('2026-09-09T00:00:00Z'),
    });
    const p = await service.getPricing('GB');
    expect(p.local).toEqual({ amountCents: 449, currency: 'gbp' }); // currencyOptions fallback
  });

  it('shows USD only when neither the feed nor currency_options has the currency', async () => {
    const { service, fx } = build({ currencyOptions: { eur: 499 } as any });
    fx.getSnapshot.mockResolvedValue({
      baseCurrency: 'usd',
      rates: { usd: 1 },
      source: 'test',
      fetchedAt: new Date(),
    });
    const p = await service.getPricing('GB');
    expect(p.local).toBeNull();
  });
});

describe('BillingService — Flutterwave (Nigeria)', () => {
  const user = { userId: 'u1', email: 'ada@example.com', displayName: 'Ada' };

  it('getPricing routes Nigeria to Flutterwave with the NGN plan amount', async () => {
    const { service } = build();
    const pricing = await service.getPricing('NG');
    expect(pricing.provider).toBe('flutterwave');
    expect(pricing.local).toEqual({ amountCents: 750000, currency: 'ngn' });
    expect(pricing.base).toEqual({ amountCents: 499, currency: 'usd' });
  });

  it('createCheckout(flutterwave) stores the tx_ref and returns the hosted link', async () => {
    const { service, rows } = build();
    const res = await service.createCheckout(user, 'flutterwave');
    expect(res).toEqual({ url: 'https://checkout.flutterwave.com/pay/abc', provider: 'flutterwave' });
    const row = rows.get('u1');
    expect(row.provider).toBe('flutterwave');
    expect(row.flwTxRef).toEqual(expect.stringMatching(/^FP-/));
  });

  it('sync verifies the transaction with Flutterwave and activates premium', async () => {
    const { service, flutterwave, rows } = build();
    await service.createCheckout(user, 'flutterwave');
    const txRef = rows.get('u1').flwTxRef;
    flutterwave.verifyTransaction.mockResolvedValue({
      id: 4242,
      tx_ref: txRef,
      status: 'successful',
      amount: 7500,
      currency: 'NGN',
      customer: { id: 1, email: 'ada@example.com' },
    });

    const res = await service.syncCheckoutSession(user, {
      provider: 'flutterwave',
      txRef,
      transactionId: '4242',
    });
    expect(flutterwave.verifyTransaction).toHaveBeenCalledWith('4242');
    expect(res.subscription.premium).toBe(true);
    expect(res.subscription.provider).toBe('flutterwave');
    expect(res.justActivated).toBe(true);
    const row = rows.get('u1');
    expect(row.presentmentCurrency).toBe('ngn');
    expect(row.presentmentAmountCents).toBe(750000);
    expect(row.basePriceCents ?? 499).toBe(499); // base price untouched
    expect(row.customerCountry).toBe('NG');
  });

  it('does NOT grant premium when the Flutterwave charge is not successful', async () => {
    const { service, flutterwave, rows } = build();
    await service.createCheckout(user, 'flutterwave');
    const txRef = rows.get('u1').flwTxRef;
    flutterwave.verifyTransaction.mockResolvedValue({
      id: 9, tx_ref: txRef, status: 'failed', amount: 7500, currency: 'NGN',
      customer: { id: 1, email: 'ada@example.com' },
    });
    const res = await service.syncCheckoutSession(user, {
      provider: 'flutterwave', txRef, transactionId: '9',
    });
    expect(res.subscription.premium).toBe(false);
    expect(res.justActivated).toBe(false);
  });

  it('rejects a Flutterwave sync whose tx_ref is not the one we stored', async () => {
    const { service } = build();
    await service.createCheckout(user, 'flutterwave');
    await expect(
      service.syncCheckoutSession(user, {
        provider: 'flutterwave', txRef: 'FP-someone-else', transactionId: '1',
      }),
    ).rejects.toThrow(/does not belong to you/);
  });

  it('rejects a Flutterwave charge in the wrong currency', async () => {
    const { service, flutterwave, rows } = build();
    await service.createCheckout(user, 'flutterwave');
    const txRef = rows.get('u1').flwTxRef;
    flutterwave.verifyTransaction.mockResolvedValue({
      id: 7, tx_ref: txRef, status: 'successful', amount: 7500, currency: 'USD',
      customer: { id: 1, email: 'ada@example.com' },
    });
    const res = await service.syncCheckoutSession(user, {
      provider: 'flutterwave', txRef, transactionId: '7',
    });
    expect(res.subscription.premium).toBe(false);
  });

  it('webhook charge.completed re-verifies and is idempotent across duplicate deliveries', async () => {
    const { service, prisma, flutterwave, rows } = build();
    await service.createCheckout(user, 'flutterwave');
    const txRef = rows.get('u1').flwTxRef;
    flutterwave.verifyTransaction.mockResolvedValue({
      id: 555, tx_ref: txRef, status: 'successful', amount: 7500, currency: 'NGN',
      customer: { id: 1, email: 'ada@example.com' },
    });
    const payload = {
      event: 'charge.completed',
      data: { id: 555, tx_ref: txRef, status: 'successful', customer: { email: 'ada@example.com' } },
    };

    prisma.webhookEvent.create.mockResolvedValueOnce({ id: 'flutterwave:555' });
    await service.handleFlutterwaveWebhook(payload);
    expect(rows.get('u1').status).toBe('active');
    expect(flutterwave.verifyTransaction).toHaveBeenCalledTimes(1);

    prisma.webhookEvent.create.mockRejectedValueOnce(uniqueViolation());
    await service.handleFlutterwaveWebhook(payload);
    expect(flutterwave.verifyTransaction).toHaveBeenCalledTimes(1); // not re-run
  });

  it('cancelFlutterwaveSubscription keeps premium until the period ends', async () => {
    const { service, flutterwave, rows } = build();
    rows.set('u1', {
      userId: 'u1',
      provider: 'flutterwave',
      status: 'active',
      flwSubscriptionId: '555',
      currentPeriodEnd: new Date(Date.now() + 10 * 86_400_000),
      cancelAtPeriodEnd: false,
    });
    const view = await service.cancelFlutterwaveSubscription('u1');
    expect(flutterwave.cancelSubscription).toHaveBeenCalledWith('555');
    expect(view.cancelAtPeriodEnd).toBe(true);
    expect(view.premium).toBe(true); // still within the paid period
  });
});

describe('BillingService — Flutterwave DEMO mode (end to end, no network)', () => {
  const OLD_ENV = { ...process.env };
  const user = { userId: 'u1', email: 'ada@example.com' };

  function buildDemo() {
    process.env = { ...OLD_ENV, FLW_DEMO_MODE: 'true', FLW_NGN_AMOUNT: '7500', WEB_APP_URL: 'https://app.test' };
    const { service, rows, prisma } = build();
    // Swap the mock for the real demo-mode service.
    const realFlw = new FlutterwaveService();
    (service as any).flutterwave = realFlw;
    return { service, rows, prisma };
  }

  afterAll(() => {
    process.env = OLD_ENV;
  });

  it('prices Nigeria from the demo plan', async () => {
    const { service } = buildDemo();
    const pricing = await service.getPricing('NG');
    expect(pricing.provider).toBe('flutterwave');
    expect(pricing.local).toEqual({ amountCents: 750000, currency: 'ngn' });
  });

  it('checkout → demo-checkout link → sync activates premium with no external call', async () => {
    const { service, rows } = buildDemo();

    const checkout = await service.createCheckout(user, 'flutterwave');
    expect(checkout.url).toMatch(/\/premium\/demo-checkout\?tx_ref=/);
    const txRef = rows.get('u1').flwTxRef;

    const res = await service.syncCheckoutSession(user, {
      provider: 'flutterwave',
      txRef,
      transactionId: `DEMO-${txRef}`,
    });
    expect(res.subscription.premium).toBe(true);
    expect(res.subscription.provider).toBe('flutterwave');
    expect(res.justActivated).toBe(true);

    const row = rows.get('u1');
    expect(row.presentmentCurrency).toBe('ngn');
    expect(row.presentmentAmountCents).toBe(750000);
    expect(row.customerCountry).toBe('NG');
    expect(row.currentPeriodEnd.getTime()).toBeGreaterThan(Date.now());
  });

  it('demo subscription is cancellable in-app and keeps premium to period end', async () => {
    const { service, rows } = buildDemo();
    await service.createCheckout(user, 'flutterwave');
    const txRef = rows.get('u1').flwTxRef;
    await service.syncCheckoutSession(user, {
      provider: 'flutterwave', txRef, transactionId: `DEMO-${txRef}`,
    });

    const view = await service.cancelFlutterwaveSubscription('u1');
    expect(view.cancelAtPeriodEnd).toBe(true);
    expect(view.premium).toBe(true);
  });
});

describe('BillingService — Stripe DEMO mode (end to end, no network)', () => {
  const OLD_ENV = { ...process.env };
  const user = { userId: 'u1', email: 'ada@example.com' };

  function buildDemo() {
    process.env = { ...OLD_ENV, STRIPE_DEMO_MODE: 'true', WEB_APP_URL: 'https://app.test' };
    delete process.env.STRIPE_SECRET_KEY;
    delete process.env.STRIPE_PRICE_ID;
    const { service, rows, prisma } = build();
    // Swap the mock for the real demo-mode service, same technique the
    // Flutterwave demo-mode suite above uses.
    (service as any).stripe = new StripeService();
    return { service, rows, prisma };
  }

  afterAll(() => {
    process.env = OLD_ENV;
  });

  it('checkout → demo-checkout link → sync activates premium with no external call', async () => {
    const { service, rows } = buildDemo();

    const checkout = await service.createCheckout(user);
    expect(checkout.provider).toBe('stripe');
    expect(checkout.url).toMatch(/\/premium\/stripe-demo-checkout\?session_id=/);
    expect(rows.get('u1').stripeCustomerId).toBe('cus_demo_u1');

    const sessionId = new URL(checkout.url).searchParams.get('session_id')!;
    const res = await service.syncCheckoutSession(user, { sessionId });
    expect(res.subscription.premium).toBe(true);
    expect(res.subscription.provider).toBe('stripe');
    expect(res.justActivated).toBe(true);

    const row = rows.get('u1');
    expect(row.stripeSubscriptionId).toBe(`sub_demo_${row.stripeCustomerId}`);
    expect(row.status).toBe('active');
    expect(row.currentPeriodEnd.getTime()).toBeGreaterThan(Date.now());
  });

  it('a demo Stripe subscription is cancellable in-app via the generic cancel dispatcher', async () => {
    const { service, rows } = buildDemo();
    const checkout = await service.createCheckout(user);
    const sessionId = new URL(checkout.url).searchParams.get('session_id')!;
    await service.syncCheckoutSession(user, { sessionId });

    const view = await service.cancelSubscription('u1');
    expect(view.cancelAtPeriodEnd).toBe(true);
    expect(view.premium).toBe(true); // still within the paid period
    expect(rows.get('u1').cancelAtPeriodEnd).toBe(true);
  });

  it('createPortal returns the local demo portal page', async () => {
    const { service, rows } = buildDemo();
    const checkout = await service.createCheckout(user);
    const sessionId = new URL(checkout.url).searchParams.get('session_id')!;
    await service.syncCheckoutSession(user, { sessionId });
    void rows;

    const { url } = await service.createPortal('u1');
    expect(url).toBe('https://app.test/premium/stripe-demo-portal');
  });
});

describe('BillingService — cancelSubscription dispatcher (mocked providers)', () => {
  it('a real (non-demo) Stripe subscription is not cancellable here — falls through to the "no subscription" 404', async () => {
    const { service, rows } = build(); // stripe mock has isDemo undefined (falsy)
    rows.set('u1', { userId: 'u1', provider: 'stripe', stripeCustomerId: 'cus_real_1' });
    await expect(service.cancelSubscription('u1')).rejects.toMatchObject({
      response: { code: 'no_subscription' },
    });
  });

  it('routes a Flutterwave subscription to the existing Flutterwave cancel path', async () => {
    const { service, flutterwave, rows } = build();
    rows.set('u1', {
      userId: 'u1',
      provider: 'flutterwave',
      flwSubscriptionId: '555',
      cancelAtPeriodEnd: false,
    });
    await service.cancelSubscription('u1');
    expect(flutterwave.cancelSubscription).toHaveBeenCalledWith('555');
  });
});

describe('BillingService — country of residence', () => {
  it('getPricing uses the country passed by the controller (resolved from the stored profile)', async () => {
    const { service } = build();
    // Controller resolves NG from the stored countryCode and passes it in.
    const p = await service.getPricing('NG');
    expect(p.provider).toBe('flutterwave');
    expect(p.local).toEqual({ amountCents: 750000, currency: 'ngn' });
  });

  it('getStoredCountry reads the user profile', async () => {
    const { service, prisma } = build();
    prisma.userProfile.findUnique.mockResolvedValueOnce({ countryCode: 'GB' });
    await expect(service.getStoredCountry('u1')).resolves.toBe('GB');
  });

  it('createCheckout with no explicit provider routes a Nigerian user to Flutterwave', async () => {
    const { service, prisma, rows } = build();
    prisma.userProfile.findUnique.mockResolvedValue({ countryCode: 'NG' });
    const res = await service.createCheckout({ userId: 'u1', email: 'ada@e.com' }); // no provider arg
    expect(res.provider).toBe('flutterwave');
    expect(rows.get('u1').provider).toBe('flutterwave');
  });

  it('createCheckout with no explicit provider routes a UK user to Stripe', async () => {
    const { service, prisma } = build();
    prisma.userProfile.findUnique.mockResolvedValue({ countryCode: 'GB' });
    const res = await service.createCheckout({ userId: 'u1', email: 'sam@e.com' });
    expect(res.provider).toBe('stripe');
  });

  it('an explicit provider still wins over the stored country', async () => {
    const { service, prisma } = build();
    prisma.userProfile.findUnique.mockResolvedValue({ countryCode: 'NG' });
    const res = await service.createCheckout({ userId: 'u1', email: 'ada@e.com' }, 'stripe');
    expect(res.provider).toBe('stripe');
  });
});
