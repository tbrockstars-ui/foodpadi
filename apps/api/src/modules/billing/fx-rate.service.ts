import { Injectable, Logger } from '@nestjs/common';
import type { FxRatesView } from '@foodpadi/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { COUNTRY_TO_CURRENCY } from './country-currency';

// Free, no-key daily feed (~161 currencies incl. NGN, updated once per day).
const FEED_URL = 'https://open.er-api.com/v6/latest/USD';
// "Spooled daily": a snapshot older than this triggers a background refresh on
// the next read. A cron isn't reliable on the current infra (Render free tier
// spins down), so refresh is read-triggered + an admin "Refresh now" button.
const REFRESH_AFTER_MS = 20 * 60 * 60 * 1000;
const MEM_TTL_MS = 10 * 60 * 1000;
const FETCH_TIMEOUT_MS = 8000;

// ISO 4217 currencies with no minor unit — their amount is whole, not /100.
const ZERO_DECIMAL = new Set([
  'bif', 'clp', 'djf', 'gnf', 'jpy', 'kmf', 'krw', 'mga', 'pyg', 'rwf',
  'ugx', 'vnd', 'vuv', 'xaf', 'xof', 'xpf',
]);

export interface FxSnapshot {
  baseCurrency: string; // always 'usd' for the feed
  /** units of <currency> per 1 unit of baseCurrency, keys lowercase */
  rates: Record<string, number>;
  source: string | null;
  fetchedAt: Date | null;
}

/**
 * Daily FX snapshot for the paywall's pre-checkout "estimated local equivalent".
 * Display-only — the payment provider's checkout amount is always authoritative
 * for the actual charge (docs/SUBSCRIPTION_MODEL.md §20). Never used to compute
 * a real charge.
 */
@Injectable()
export class FxRateService {
  private readonly logger = new Logger(FxRateService.name);
  private mem: { at: number; snap: FxSnapshot } | null = null;
  private refreshing: Promise<unknown> | null = null;

  constructor(private readonly prisma: PrismaService) {}

  /**
   * The current rates. If the stored snapshot is missing or older than ~20h,
   * kicks off a background refresh and returns whatever we have right now
   * (stale rates, or an empty set on a cold start until the refresh lands).
   */
  async getSnapshot(): Promise<FxSnapshot> {
    if (this.mem && Date.now() - this.mem.at < MEM_TTL_MS) {
      this.maybeRefresh(this.mem.snap);
      return this.mem.snap;
    }
    const row = await this.prisma.fxRateSnapshot
      .findUnique({ where: { id: 'latest' } })
      .catch(() => null);
    const snap: FxSnapshot = row
      ? {
          baseCurrency: row.baseCurrency,
          rates: (row.rates ?? {}) as Record<string, number>,
          source: row.source,
          fetchedAt: row.fetchedAt,
        }
      : { baseCurrency: 'usd', rates: {}, source: null, fetchedAt: null };
    this.mem = { at: Date.now(), snap };
    this.maybeRefresh(snap);
    return snap;
  }

  private maybeRefresh(snap: FxSnapshot): void {
    const stale =
      !snap.fetchedAt || Date.now() - snap.fetchedAt.getTime() > REFRESH_AFTER_MS;
    if (!stale || this.refreshing) return;
    this.refreshing = this.refresh()
      .catch((err) => this.logger.warn(`Background FX refresh failed: ${String(err)}`))
      .finally(() => {
        this.refreshing = null;
      });
  }

  /** Fetch fresh rates from the feed and persist them. Returns the new snapshot. */
  async refresh(): Promise<FxSnapshot> {
    const res = await fetch(FEED_URL, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    const body = (await res.json().catch(() => null)) as {
      result?: string;
      rates?: Record<string, unknown>;
      provider?: string;
      time_last_update_utc?: string;
    } | null;
    if (!res.ok || !body || body.result !== 'success' || !body.rates) {
      throw new Error(`FX feed ${res.status} / result=${body?.result}`);
    }
    const rates: Record<string, number> = {};
    for (const [k, v] of Object.entries(body.rates)) {
      const n = Number(v);
      if (Number.isFinite(n) && n > 0) rates[k.toLowerCase()] = n;
    }
    if (Object.keys(rates).length < 20) {
      throw new Error(`FX feed returned only ${Object.keys(rates).length} rates — ignoring`);
    }
    const source = body.provider ?? 'open.er-api.com';
    const fetchedAt = new Date();
    await this.prisma.fxRateSnapshot.upsert({
      where: { id: 'latest' },
      create: { id: 'latest', baseCurrency: 'usd', rates, source, fetchedAt },
      update: { rates, source, fetchedAt },
    });
    const snap: FxSnapshot = { baseCurrency: 'usd', rates, source, fetchedAt };
    this.mem = { at: Date.now(), snap };
    this.logger.log(`FX rates refreshed: ${Object.keys(rates).length} currencies from ${source}`);
    return snap;
  }

  static isZeroDecimal(currency: string): boolean {
    return ZERO_DECIMAL.has(currency.toLowerCase());
  }

  /** Every currency FoodPadi routes a country to, deduped + sorted. */
  static allCurrencies(): string[] {
    return [...new Set(Object.values(COUNTRY_TO_CURRENCY).map((c) => c.toLowerCase()))].sort();
  }

  /**
   * The admin-dashboard view: today's rate + the current base price converted
   * for every currency we support.
   */
  async buildView(baseMinor: number, baseCurrency: string): Promise<FxRatesView> {
    const snap = await this.getSnapshot();
    const base = baseCurrency.toLowerCase();
    const rows = FxRateService.allCurrencies()
      .filter((c) => c !== base)
      .map((currency) => {
        const rate = snap.rates[currency] ?? null;
        const amount = FxRateService.estimate(snap, baseMinor, base, currency);
        return {
          currency,
          rate,
          estimated: amount != null ? { amountCents: amount, currency } : null,
        };
      });
    return {
      baseCurrency: base,
      source: snap.source,
      fetchedAt: snap.fetchedAt ? snap.fetchedAt.toISOString() : null,
      ageHours: snap.fetchedAt
        ? Math.floor((Date.now() - snap.fetchedAt.getTime()) / 3_600_000)
        : null,
      rows,
    };
  }

  /**
   * `baseMinor` (minor units of `baseCurrency`) converted to minor units of
   * `target` at the snapshot's rate. `null` when no rate is known.
   */
  static estimate(
    snap: FxSnapshot,
    baseMinor: number,
    baseCurrency: string,
    target: string,
  ): number | null {
    const b = baseCurrency.toLowerCase();
    const t = target.toLowerCase();
    if (t === b) return baseMinor;
    // The feed is USD-based; if our base ever isn't USD, cross via USD.
    const rateT = snap.rates[t];
    const rateB = b === 'usd' ? 1 : snap.rates[b];
    if (!rateT || !rateB) return null;
    const baseMajor = FxRateService.isZeroDecimal(b) ? baseMinor : baseMinor / 100;
    const usdMajor = baseMajor / rateB;
    const targetMajor = usdMajor * rateT;
    return FxRateService.isZeroDecimal(t)
      ? Math.round(targetMajor)
      : Math.round(targetMajor * 100);
  }
}
