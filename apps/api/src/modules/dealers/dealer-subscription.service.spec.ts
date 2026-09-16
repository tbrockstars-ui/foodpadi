import { ConflictException } from '@nestjs/common';
import type Stripe from 'stripe';
import { DealerSubscriptionService } from './dealer-subscription.service';
import { DealerEntitlementService } from './dealer-entitlement.service';
import { StripeService } from '../billing/stripe.service';
import { FlutterwaveService } from '../billing/flutterwave.service';
import { PrismaService } from '../../prisma/prisma.service';

// A stateful in-memory stand-in for the single DealerSubscription row + the
// webhook_events idempotency ledger, so "no duplicate rows on renewal" and
// "event processed once" are real assertions rather than mock-call counting.
function makeContext() {
  let subRow: any = null;
  let dealerRow: any = { id: 'd1', activatedAt: null, listingStatus: 'pending_review', profileCompleteness: 80 };
  const ledger = new Set<string>();

  const prisma: any = {
    dealerSubscription: {
      findUnique: jest.fn(async ({ where }: any) => {
        if (where.dealerId && where.dealerId !== 'd1') return null;
        if (where.stripeSubscriptionId && subRow?.stripeSubscriptionId !== where.stripeSubscriptionId) return null;
        if (where.stripeCustomerId && subRow?.stripeCustomerId !== where.stripeCustomerId) return null;
        if (where.flwTxRef && subRow?.flwTxRef !== where.flwTxRef) return null;
        return subRow;
      }),
      findFirst: jest.fn(async () => subRow),
      upsert: jest.fn(async ({ create, update }: any) => {
        subRow = subRow ? { ...subRow, ...update } : { id: 'ds1', dealerId: 'd1', ...create };
        return subRow;
      }),
      update: jest.fn(async ({ data }: any) => {
        subRow = { ...subRow, ...data };
        return subRow;
      }),
    },
    dealer: {
      findUnique: jest.fn(async () => ({ ...dealerRow, locations: [], products: [] })),
      updateMany: jest.fn(async ({ where, data }: any) => {
        if (where.activatedAt === null && dealerRow.activatedAt !== null) return { count: 0 };
        dealerRow = { ...dealerRow, ...data };
        return { count: 1 };
      }),
      update: jest.fn(async ({ data }: any) => {
        dealerRow = { ...dealerRow, ...data };
        return dealerRow;
      }),
    },
    userProfile: { findUnique: jest.fn(async () => ({ countryCode: 'GB' })) },
    webhookEvent: {
      create: jest.fn(async ({ data }: any) => {
        if (ledger.has(data.id)) {
          const err: any = new Error('unique');
          err.code = 'P2002';
          err.constructor = { name: 'PrismaClientKnownRequestError' };
          // The service checks `instanceof Prisma.PrismaClientKnownRequestError`.
          Object.setPrototypeOf(err, require('@prisma/client').Prisma.PrismaClientKnownRequestError.prototype);
          throw err;
        }
        ledger.add(data.id);
        return data;
      }),
      delete: jest.fn(async ({ where }: any) => {
        ledger.delete(where.id);
        return {};
      }),
    },
  };

  const entitlement = {
    computeEntitlement: DealerEntitlementService.prototype.computeEntitlement,
    getEntitlement: jest.fn(async () => DealerEntitlementService.prototype.computeEntitlement(subRow, 3)),
    isActive: jest.fn(async () => DealerEntitlementService.prototype.computeEntitlement(subRow, 3).active),
  } as unknown as DealerEntitlementService;

  const searchProfile = { rebuild: jest.fn().mockResolvedValue(undefined) } as any;
  const stripe = new StripeService();
  const flw = new FlutterwaveService();
  // Admin billing config — only the dealer price bits are read here.
  const config = {
    getResolved: jest.fn().mockResolvedValue({
      baseCurrency: 'usd',
      dealerPriceCents: 499,
      dealerNgnAmount: 7500,
      dealerStripePriceId: null,
      pastDueGraceDays: 3,
    }),
  } as any;
  const svc = new DealerSubscriptionService(
    prisma as unknown as PrismaService,
    stripe,
    flw,
    entitlement,
    searchProfile,
    config,
  );

  return {
    svc,
    prisma,
    searchProfile,
    getSubRow: () => subRow,
    getDealerRow: () => dealerRow,
  };
}

const OLD_ENV = { ...process.env };
beforeEach(() => {
  process.env.STRIPE_DEMO_MODE = 'true';
  process.env.FLW_DEMO_MODE = 'true';
  delete process.env.DEALER_PAST_DUE_GRACE_DAYS;
  delete process.env.STRIPE_PAST_DUE_GRACE_DAYS;
});
afterEach(() => {
  process.env = { ...OLD_ENV };
});

const actor = { dealerId: 'd1', ownerUserId: 'u1', email: 'owner@example.com', name: 'Mama' };

function activeStripeSub(overrides: Partial<Stripe.Subscription> = {}): Stripe.Subscription {
  const now = Math.floor(Date.now() / 1000);
  return {
    id: 'sub_live_1',
    object: 'subscription',
    status: 'active',
    customer: 'cus_demo_u1',
    items: { object: 'list', data: [{ price: { id: 'price_dealer_demo' } }] },
    current_period_end: now + 30 * 24 * 60 * 60,
    cancel_at_period_end: false,
    canceled_at: null,
    trial_end: null,
    metadata: { foodpadiDealerId: 'd1' },
    ...overrides,
  } as unknown as Stripe.Subscription;
}

describe('DealerSubscriptionService.createCheckout', () => {
  it('demo mode → returns a dealer demo checkout URL and upserts the row keyed on dealerId', async () => {
    const { svc, prisma, getSubRow } = makeContext();
    const res = await svc.createCheckout(actor);
    expect(res.provider).toBe('stripe');
    expect(res.url).toContain('/dealers/onboarding/demo-checkout');
    expect(prisma.dealerSubscription.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { dealerId: 'd1' } }),
    );
    expect(getSubRow()).toMatchObject({ dealerId: 'd1', provider: 'stripe' });
  });

  it('called twice → still one row (upsert keyed on dealerId), reuses the demo customer', async () => {
    const { svc, prisma, getSubRow } = makeContext();
    await svc.createCheckout(actor);
    const firstCustomer = getSubRow().stripeCustomerId;
    await svc.createCheckout(actor);
    expect(getSubRow().stripeCustomerId).toBe(firstCustomer);
    // Every upsert targeted the same dealerId — never a create of a second row.
    for (const call of prisma.dealerSubscription.upsert.mock.calls) {
      expect(call[0].where).toEqual({ dealerId: 'd1' });
    }
  });

  it('already-active subscription → 409 already_active', async () => {
    const { svc } = makeContext();
    await svc.createCheckout(actor); // seeds an incomplete row
    // Promote it to active via a webhook, then a second checkout must be refused.
    await svc.handleStripeWebhook({
      id: 'evt_1',
      type: 'customer.subscription.updated',
      data: { object: activeStripeSub() },
    } as unknown as Stripe.Event);
    await expect(svc.createCheckout(actor)).rejects.toBeInstanceOf(ConflictException);
  });
});

describe('DealerSubscriptionService webhooks', () => {
  it('activate → subscription row active, search profile rebuilt (rebuild alone decides listing activation)', async () => {
    // Whether the LISTING actually goes active — and activatedAt gets stamped —
    // is entirely DealerSearchProfileService.rebuild's call (admin-approval-
    // before-payment business rule: a payment can never activate an
    // unapproved dealer). That gate is unit-tested in
    // dealer-search-profile.service.spec.ts; here `rebuild` is a mock, so this
    // spec only asserts the subscription row itself and that rebuild ran.
    const { svc, searchProfile, getSubRow } = makeContext();
    await svc.createCheckout(actor);
    await svc.handleStripeWebhook({
      id: 'evt_activate',
      type: 'customer.subscription.updated',
      data: { object: activeStripeSub() },
    } as unknown as Stripe.Event);

    expect(getSubRow().status).toBe('active');
    expect(searchProfile.rebuild).toHaveBeenCalledWith('d1');
  });

  it('renewal (second subscription.updated) → same single row, no duplicate', async () => {
    const { svc, prisma, getSubRow } = makeContext();
    await svc.createCheckout(actor);
    await svc.handleStripeWebhook({
      id: 'evt_a',
      type: 'customer.subscription.updated',
      data: { object: activeStripeSub() },
    } as unknown as Stripe.Event);

    const laterEnd = Math.floor(Date.now() / 1000) + 60 * 24 * 60 * 60;
    await svc.handleStripeWebhook({
      id: 'evt_b',
      type: 'customer.subscription.updated',
      data: { object: activeStripeSub({ current_period_end: laterEnd }) },
    } as unknown as Stripe.Event);

    expect(getSubRow().id).toBe('ds1');
    expect(getSubRow().status).toBe('active');
    // Never a `.create` on the row — only upserts keyed on dealerId.
    expect(prisma.dealerSubscription.upsert.mock.calls.every((c: any[]) => c[0].where.dealerId === 'd1')).toBe(true);
  });

  it('cancel (subscription.deleted) → status canceled, not active, search profile rebuilt', async () => {
    const { svc, searchProfile, getSubRow } = makeContext();
    await svc.createCheckout(actor);
    await svc.handleStripeWebhook({
      id: 'evt_a2',
      type: 'customer.subscription.updated',
      data: { object: activeStripeSub() },
    } as unknown as Stripe.Event);

    await svc.handleStripeWebhook({
      id: 'evt_cancel',
      type: 'customer.subscription.deleted',
      data: { object: activeStripeSub({ status: 'canceled' }) },
    } as unknown as Stripe.Event);

    expect(getSubRow().status).toBe('canceled');
    expect(DealerEntitlementService.prototype.computeEntitlement(getSubRow(), 3).active).toBe(false);
    expect(searchProfile.rebuild).toHaveBeenLastCalledWith('d1');
  });

  it('duplicate event id → handler runs only once (idempotency ledger)', async () => {
    const { svc, searchProfile } = makeContext();
    await svc.createCheckout(actor);
    const event = {
      id: 'evt_dup',
      type: 'customer.subscription.updated',
      data: { object: activeStripeSub() },
    } as unknown as Stripe.Event;
    await svc.handleStripeWebhook(event);
    const callsAfterFirst = searchProfile.rebuild.mock.calls.length;
    await svc.handleStripeWebhook(event); // same id — must be skipped
    expect(searchProfile.rebuild.mock.calls.length).toBe(callsAfterFirst);
  });
});

describe('DealerSubscriptionService.getView', () => {
  it('no row → free/none view', async () => {
    const { svc } = makeContext();
    const v = await svc.getView('d1');
    expect(v).toMatchObject({ status: 'none', active: false, provider: 'stripe' });
    expect(v.price.amountCents).toBe(499); // admin-managed dealer price, default $4.99
  });
});
