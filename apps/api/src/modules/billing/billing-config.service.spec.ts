import { BadRequestException } from '@nestjs/common';
import { BillingConfigService } from './billing-config.service';
import { PrismaService } from '../../prisma/prisma.service';
import { StripeService } from './stripe.service';
import { FlutterwaveService } from './flutterwave.service';

function build(opts: { stripeConfigured?: boolean; flwConfigured?: boolean; flwDemo?: boolean } = {}) {
  let row: any = {
    id: 'singleton',
    basePriceCents: 499,
    baseCurrency: 'usd',
    trialDays: 0,
    flwNgnAmount: 7500,
    currencyOptions: {},
    stripePriceId: null,
    flwPlanId: null,
    dealerPriceCents: 499,
    dealerNgnAmount: 7500,
    dealerStripePriceId: null,
    dealerFlwPlanId: null,
    updatedAt: new Date('2026-09-07T00:00:00Z'),
  };
  // The row is treated as already existing with defaults, so upsert always
  // takes the `update` branch (matching real Prisma: `update: {}` is a no-op
  // read, it does NOT re-apply `create`).
  const prisma: any = {
    billingConfig: {
      upsert: jest.fn(({ update }: any) => {
        row = { ...row, ...update };
        return Promise.resolve(row);
      }),
      update: jest.fn(({ data }: any) => {
        row = { ...row, ...data };
        return Promise.resolve(row);
      }),
    },
  };
  const stripe: any = {
    isConfigured: opts.stripeConfigured ?? false,
    updatePriceCurrencyOptions: jest.fn().mockResolvedValue(undefined),
    createReplacementPrice: jest.fn().mockResolvedValue('price_new'),
  };
  const flutterwave: any = {
    isConfigured: opts.flwConfigured ?? false,
    isDemo: opts.flwDemo ?? false,
    demoAmountNairaOverride: null,
    createPaymentPlan: jest.fn().mockResolvedValue('9012'),
  };
  const svc = new BillingConfigService(
    prisma as unknown as PrismaService,
    stripe as unknown as StripeService,
    flutterwave as unknown as FlutterwaveService,
  );
  return { svc, prisma, stripe, flutterwave, getRow: () => row };
}

describe('BillingConfigService.getResolved', () => {
  it('falls back to the seeded currency options when the row JSON is empty', async () => {
    const { svc } = build();
    const r = await svc.getResolved();
    expect(r.basePriceCents).toBe(499);
    expect(r.currencyOptions.gbp).toBeGreaterThan(0);
    expect(r.currencyOptions.hkd).toBeGreaterThan(0); // non-European currency seeded
  });

  it('keeps the demo Flutterwave amount in step with the NG price', async () => {
    const { svc, flutterwave } = build({ flwDemo: true });
    await svc.getResolved();
    expect(flutterwave.demoAmountNairaOverride).toBe(7500);
  });
});

describe('BillingConfigService.update — validation', () => {
  it('rejects a silly base price', async () => {
    const { svc } = build();
    await expect(svc.update({ basePriceCents: 5 })).rejects.toThrow(BadRequestException);
    await expect(svc.update({ basePriceCents: 9_999_999 })).rejects.toThrow(BadRequestException);
  });

  it('rejects a bad currency code and a bad currency amount', async () => {
    const { svc } = build();
    await expect(svc.update({ currencyOptions: { pounds: 400 } as any })).rejects.toThrow(
      /valid 3-letter currency/,
    );
    await expect(svc.update({ currencyOptions: { gbp: -1 } })).rejects.toThrow(/positive integer/);
  });

  it('rejects an out-of-range trial length', async () => {
    const { svc } = build();
    await expect(svc.update({ trialDays: 365 })).rejects.toThrow(BadRequestException);
  });

  it('validates and persists the Food Dealer subscription price', async () => {
    const { svc, getRow } = build();
    await expect(svc.update({ dealerPriceCents: 10 })).rejects.toThrow(BadRequestException);
    const { warnings } = await svc.update({ dealerPriceCents: 499 });
    expect(warnings).toEqual([]);
    expect(getRow().dealerPriceCents).toBe(499);
    const view = await svc.getView();
    expect(view.dealerPriceCents).toBe(499);
  });
});

describe('BillingConfigService.update — provider sync', () => {
  it('with no providers configured, just writes the DB and returns no warnings', async () => {
    const { svc, prisma } = build();
    const { warnings } = await svc.update({ basePriceCents: 599, trialDays: 7 });
    expect(warnings).toEqual([]);
    expect(prisma.billingConfig.upsert).toHaveBeenCalled();
  });

  it('pushes currency_options to the existing Stripe price when only those change', async () => {
    const { svc, stripe, getRow } = build({ stripeConfigured: true });
    getRow().stripePriceId = 'price_live';
    const { warnings } = await svc.update({ currencyOptions: { gbp: 399, eur: 449 } });
    expect(stripe.updatePriceCurrencyOptions).toHaveBeenCalledWith(
      'price_live',
      expect.objectContaining({ gbp: 399, eur: 449 }),
    );
    expect(stripe.createReplacementPrice).not.toHaveBeenCalled();
    expect(warnings).toEqual([]);
  });

  it('mints a replacement Stripe price when the base price changes', async () => {
    const { svc, stripe, getRow } = build({ stripeConfigured: true });
    getRow().stripePriceId = 'price_old';
    const { warnings } = await svc.update({ basePriceCents: 799 });
    expect(stripe.createReplacementPrice).toHaveBeenCalledWith(
      expect.objectContaining({ unitAmount: 799, archivePriceId: 'price_old' }),
    );
    expect(warnings).toEqual([]);
    expect(getRow().stripePriceId).toBe('price_new');
  });

  it('surfaces a warning (but still saves) when the Stripe push fails', async () => {
    const { svc, stripe, getRow } = build({ stripeConfigured: true });
    getRow().stripePriceId = 'price_old';
    stripe.createReplacementPrice.mockRejectedValue(new Error('stripe unreachable'));
    const { warnings } = await svc.update({ basePriceCents: 899 });
    expect(warnings[0]).toMatch(/Stripe was not updated/);
    expect(getRow().basePriceCents).toBe(899); // DB still updated
  });

  it('creates a new Flutterwave plan when the NG price changes (real mode only)', async () => {
    const { svc, flutterwave, getRow } = build({ flwConfigured: true, flwDemo: false });
    const { warnings } = await svc.update({ flwNgnAmount: 9000 });
    expect(flutterwave.createPaymentPlan).toHaveBeenCalledWith(9000);
    expect(getRow().flwPlanId).toBe('9012');
    expect(warnings).toEqual([]);
  });

  it('does NOT touch Flutterwave in demo mode', async () => {
    const { svc, flutterwave } = build({ flwConfigured: true, flwDemo: true });
    await svc.update({ flwNgnAmount: 9000 });
    expect(flutterwave.createPaymentPlan).not.toHaveBeenCalled();
  });
});
