import { FxRateService, type FxSnapshot } from './fx-rate.service';
import { PrismaService } from '../../prisma/prisma.service';

const SNAP: FxSnapshot = {
  baseCurrency: 'usd',
  rates: { usd: 1, gbp: 0.8, eur: 0.9, jpy: 150, ngn: 1600 },
  source: 'test',
  fetchedAt: new Date('2026-09-09T00:00:00Z'),
};

describe('FxRateService.estimate', () => {
  it('converts USD minor units to a normal 2-decimal currency', () => {
    // $4.99 * 0.80 = £3.992 -> 399 pence
    expect(FxRateService.estimate(SNAP, 499, 'usd', 'gbp')).toBe(399);
  });

  it('converts to a zero-decimal currency as whole units', () => {
    // $4.99 * 150 = ¥748.5 -> ¥749
    expect(FxRateService.estimate(SNAP, 499, 'usd', 'jpy')).toBe(749);
    // $4.99 * 1600 = ₦7984 (NGN has minor units in ISO, so *100)
    expect(FxRateService.estimate(SNAP, 499, 'usd', 'ngn')).toBe(798400);
  });

  it('returns the input unchanged when target == base', () => {
    expect(FxRateService.estimate(SNAP, 499, 'usd', 'usd')).toBe(499);
  });

  it('returns null when the snapshot has no rate for the target', () => {
    expect(FxRateService.estimate(SNAP, 499, 'usd', 'zar')).toBeNull();
  });

  it('crosses via USD when the base currency is not USD', () => {
    // base £4.00 -> USD 5.00 -> EUR 4.50 -> 450 cents
    expect(FxRateService.estimate(SNAP, 400, 'gbp', 'eur')).toBe(450);
  });
});

describe('FxRateService.buildView', () => {
  function svc(row: any) {
    const prisma: any = { fxRateSnapshot: { findUnique: jest.fn().mockResolvedValue(row), upsert: jest.fn() } };
    return new FxRateService(prisma as unknown as PrismaService);
  }

  it('returns a row per supported currency with the converted base price', async () => {
    const s = svc({
      baseCurrency: 'usd',
      rates: { gbp: 0.8, eur: 0.9 },
      source: 'test',
      fetchedAt: new Date(Date.now() - 2 * 3_600_000),
    });
    const view = await s.buildView(499, 'usd');
    expect(view.baseCurrency).toBe('usd');
    expect(view.ageHours).toBe(2);
    const gbp = view.rows.find((r) => r.currency === 'gbp');
    expect(gbp).toEqual({ currency: 'gbp', rate: 0.8, estimated: { amountCents: 399, currency: 'gbp' } });
    const zar = view.rows.find((r) => r.currency === 'zar');
    expect(zar).toEqual({ currency: 'zar', rate: null, estimated: null });
  });
});
