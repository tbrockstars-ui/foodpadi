import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import type { BillingConfig } from '@prisma/client';
import {
  DEFAULT_CURRENCY_OPTIONS,
  type BillingConfigView,
  type UpdateBillingConfigRequest,
} from '@foodpadi/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { StripeService } from './stripe.service';
import { FlutterwaveService } from './flutterwave.service';

const SINGLETON_ID = 'singleton';
const CACHE_TTL_MS = 30_000;

export interface ResolvedBillingConfig {
  basePriceCents: number;
  baseCurrency: string;
  billingInterval: 'month';
  trialDays: number;
  appTrialDays: number;
  trialAiLimit: number;
  pastDueGraceDays: number;
  flwNgnAmount: number;
  currencyOptions: Record<string, number>;
  /** Effective provider ids: admin override, else env. */
  stripePriceId: string | null;
  flwPlanId: string | null;
  // FoodPadi Food Dealer Network subscription (a separate product from Premium).
  dealerPriceCents: number;
  dealerNgnAmount: number;
  dealerStripePriceId: string | null;
  dealerFlwPlanId: string | null;
  updatedAt: Date | null;
}

/**
 * Owns the single `billing_config` row — the "dynamic parameterised
 * subscription value management" store the admin dashboard edits. Everything
 * else in the billing module reads business values (price, trial, per-currency
 * amounts, NG price) from here instead of hard-coded literals or env. A change
 * writes the DB first, then best-effort pushes to the provider (Stripe Prices
 * and Flutterwave plans are immutable, so a price change mints a new one and
 * its id is stored back on the row).
 */
@Injectable()
export class BillingConfigService {
  private readonly logger = new Logger(BillingConfigService.name);
  private cache: { at: number; row: BillingConfig } | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly stripe: StripeService,
    private readonly flutterwave: FlutterwaveService,
  ) {}

  private async getRow(force = false): Promise<BillingConfig> {
    if (!force && this.cache && Date.now() - this.cache.at < CACHE_TTL_MS) {
      return this.cache.row;
    }
    const row = await this.prisma.billingConfig.upsert({
      where: { id: SINGLETON_ID },
      create: { id: SINGLETON_ID, currencyOptions: DEFAULT_CURRENCY_OPTIONS },
      update: {},
    });
    this.cache = { at: Date.now(), row };
    return row;
  }

  private bustCache(): void {
    this.cache = null;
  }

  async getResolved(): Promise<ResolvedBillingConfig> {
    const row = await this.getRow();
    const stored = (row.currencyOptions ?? {}) as Record<string, number>;
    // Keep the demo Flutterwave amount in step with the admin-managed NG price
    // (one-way, so no dependency cycle).
    this.flutterwave.demoAmountNairaOverride = row.flwNgnAmount;
    return {
      basePriceCents: row.basePriceCents,
      baseCurrency: row.baseCurrency,
      billingInterval: 'month',
      trialDays: row.trialDays,
      appTrialDays: row.appTrialDays,
      trialAiLimit: row.trialAiLimit,
      pastDueGraceDays: row.pastDueGraceDays,
      flwNgnAmount: row.flwNgnAmount,
      // A fresh row's JSON can be empty — fall back to the seed so the
      // standard currencies always have an amount.
      currencyOptions: Object.keys(stored).length ? stored : { ...DEFAULT_CURRENCY_OPTIONS },
      stripePriceId: row.stripePriceId ?? process.env.STRIPE_PRICE_ID ?? null,
      flwPlanId: row.flwPlanId ?? process.env.FLW_PLAN_ID ?? null,
      dealerPriceCents: row.dealerPriceCents,
      dealerNgnAmount: row.dealerNgnAmount,
      dealerStripePriceId: row.dealerStripePriceId ?? process.env.STRIPE_DEALER_PRICE_ID ?? null,
      dealerFlwPlanId: row.dealerFlwPlanId ?? process.env.FLW_DEALER_PLAN_ID ?? null,
      updatedAt: row.updatedAt ?? null,
    };
  }

  async getView(): Promise<BillingConfigView> {
    const r = await this.getResolved();
    return {
      basePriceCents: r.basePriceCents,
      baseCurrency: r.baseCurrency,
      billingInterval: 'month',
      trialDays: r.trialDays,
      appTrialDays: r.appTrialDays,
      trialAiLimit: r.trialAiLimit,
      pastDueGraceDays: r.pastDueGraceDays,
      flwNgnAmount: r.flwNgnAmount,
      currencyOptions: r.currencyOptions,
      stripePriceId: r.stripePriceId,
      flwPlanId: r.flwPlanId,
      dealerPriceCents: r.dealerPriceCents,
      dealerNgnAmount: r.dealerNgnAmount,
      dealerStripePriceId: r.dealerStripePriceId,
      dealerFlwPlanId: r.dealerFlwPlanId,
      updatedAt: r.updatedAt ? r.updatedAt.toISOString() : null,
      stripeConfigured: this.stripe.isConfigured,
      stripeDemo: this.stripe.isDemo,
      flutterwaveConfigured: this.flutterwave.isConfigured,
      flutterwaveDemo: this.flutterwave.isDemo,
    };
  }

  /**
   * Apply an admin change. Validates, writes the DB, then best-effort syncs to
   * the providers. Provider failures don't roll back the DB — they come back as
   * `warnings` so the admin knows checkout amounts may lag until retried.
   */
  async update(
    patch: UpdateBillingConfigRequest,
    updatedBy?: string | null,
  ): Promise<{ warnings: string[] }> {
    const warnings: string[] = [];
    const current = await this.getResolved();

    const data: Record<string, unknown> = {};
    if (patch.basePriceCents !== undefined) {
      if (!Number.isInteger(patch.basePriceCents) || patch.basePriceCents < 50 || patch.basePriceCents > 5_000_00) {
        throw new BadRequestException('basePriceCents must be an integer between 50 and 500000.');
      }
      data.basePriceCents = patch.basePriceCents;
    }
    if (patch.baseCurrency !== undefined) {
      if (!/^[a-z]{3}$/.test(patch.baseCurrency)) {
        throw new BadRequestException('baseCurrency must be a 3-letter lowercase ISO code.');
      }
      data.baseCurrency = patch.baseCurrency;
    }
    if (patch.trialDays !== undefined) {
      if (!Number.isInteger(patch.trialDays) || patch.trialDays < 0 || patch.trialDays > 90) {
        throw new BadRequestException('trialDays must be an integer between 0 and 90.');
      }
      data.trialDays = patch.trialDays;
    }
    if (patch.appTrialDays !== undefined) {
      if (!Number.isInteger(patch.appTrialDays) || patch.appTrialDays < 0 || patch.appTrialDays > 90) {
        throw new BadRequestException('appTrialDays must be an integer between 0 and 90.');
      }
      data.appTrialDays = patch.appTrialDays;
    }
    if (patch.trialAiLimit !== undefined) {
      if (!Number.isInteger(patch.trialAiLimit) || patch.trialAiLimit < 0 || patch.trialAiLimit > 100_000) {
        throw new BadRequestException('trialAiLimit must be an integer between 0 and 100000.');
      }
      data.trialAiLimit = patch.trialAiLimit;
    }
    if (patch.pastDueGraceDays !== undefined) {
      if (!Number.isInteger(patch.pastDueGraceDays) || patch.pastDueGraceDays < 0 || patch.pastDueGraceDays > 30) {
        throw new BadRequestException('pastDueGraceDays must be an integer between 0 and 30.');
      }
      data.pastDueGraceDays = patch.pastDueGraceDays;
    }
    if (patch.flwNgnAmount !== undefined) {
      if (!Number.isInteger(patch.flwNgnAmount) || patch.flwNgnAmount < 100 || patch.flwNgnAmount > 100_000_000) {
        throw new BadRequestException('flwNgnAmount must be an integer between 100 and 100000000 (whole Naira).');
      }
      data.flwNgnAmount = patch.flwNgnAmount;
    }
    if (patch.dealerPriceCents !== undefined) {
      if (!Number.isInteger(patch.dealerPriceCents) || patch.dealerPriceCents < 50 || patch.dealerPriceCents > 5_000_00) {
        throw new BadRequestException('dealerPriceCents must be an integer between 50 and 500000.');
      }
      data.dealerPriceCents = patch.dealerPriceCents;
    }
    if (patch.dealerNgnAmount !== undefined) {
      if (!Number.isInteger(patch.dealerNgnAmount) || patch.dealerNgnAmount < 100 || patch.dealerNgnAmount > 100_000_000) {
        throw new BadRequestException('dealerNgnAmount must be an integer between 100 and 100000000 (whole Naira).');
      }
      data.dealerNgnAmount = patch.dealerNgnAmount;
    }
    if (patch.currencyOptions !== undefined) {
      data.currencyOptions = normaliseCurrencyOptions(patch.currencyOptions);
    }
    if (updatedBy) data.updatedBy = updatedBy;

    if (Object.keys(data).length === 0) {
      return { warnings };
    }

    await this.prisma.billingConfig.upsert({
      where: { id: SINGLETON_ID },
      create: { id: SINGLETON_ID, currencyOptions: DEFAULT_CURRENCY_OPTIONS, ...data },
      update: data,
    });
    this.bustCache();
    const next = await this.getResolved();

    // --- Provider sync (best effort) ---------------------------------------
    const basePriceChanged =
      patch.basePriceCents !== undefined && patch.basePriceCents !== current.basePriceCents;
    const baseCurrencyChanged =
      patch.baseCurrency !== undefined && patch.baseCurrency !== current.baseCurrency;
    const currencyOptionsChanged = patch.currencyOptions !== undefined;
    const flwAmountChanged =
      patch.flwNgnAmount !== undefined && patch.flwNgnAmount !== current.flwNgnAmount;

    if (this.stripe.isConfigured && !this.stripe.isDemo && (basePriceChanged || baseCurrencyChanged)) {
      try {
        const newPriceId = await this.stripe.createReplacementPrice({
          unitAmount: next.basePriceCents,
          currency: next.baseCurrency,
          currencyOptions: next.currencyOptions,
          archivePriceId: current.stripePriceId,
        });
        await this.prisma.billingConfig.update({
          where: { id: SINGLETON_ID },
          data: { stripePriceId: newPriceId },
        });
        this.bustCache();
      } catch (err) {
        warnings.push(
          `Saved, but Stripe was not updated: ${String(
            (err as Error).message ?? err,
          )}. New Stripe checkouts still use the old price until this is retried.`,
        );
      }
    } else if (
      this.stripe.isConfigured &&
      !this.stripe.isDemo &&
      currencyOptionsChanged &&
      current.stripePriceId
    ) {
      try {
        await this.stripe.updatePriceCurrencyOptions(current.stripePriceId, next.currencyOptions);
      } catch (err) {
        warnings.push(
          `Saved, but Stripe currency options were not pushed: ${String((err as Error).message ?? err)}.`,
        );
      }
    }

    if (this.flutterwave.isConfigured && !this.flutterwave.isDemo && flwAmountChanged) {
      try {
        const planId = await this.flutterwave.createPaymentPlan(next.flwNgnAmount);
        await this.prisma.billingConfig.update({
          where: { id: SINGLETON_ID },
          data: { flwPlanId: planId },
        });
        this.bustCache();
      } catch (err) {
        warnings.push(
          `Saved, but a new Flutterwave plan was not created: ${String((err as Error).message ?? err)}.`,
        );
      }
    }

    // --- Dealer subscription provider sync (best effort) -----------------
    const dealerPriceChanged =
      patch.dealerPriceCents !== undefined && patch.dealerPriceCents !== current.dealerPriceCents;
    if (this.stripe.isConfigured && !this.stripe.isDemo && (dealerPriceChanged || baseCurrencyChanged)) {
      try {
        const newPriceId = await this.stripe.createReplacementDealerPrice({
          unitAmount: next.dealerPriceCents,
          currency: next.baseCurrency,
          archivePriceId: current.dealerStripePriceId,
        });
        await this.prisma.billingConfig.update({
          where: { id: SINGLETON_ID },
          data: { dealerStripePriceId: newPriceId },
        });
        this.bustCache();
      } catch (err) {
        warnings.push(
          `Saved, but the Stripe dealer price was not updated: ${String((err as Error).message ?? err)}. New dealer checkouts use the old price until this is retried.`,
        );
      }
    }
    const dealerNgnChanged =
      patch.dealerNgnAmount !== undefined && patch.dealerNgnAmount !== current.dealerNgnAmount;
    if (this.flutterwave.isConfigured && !this.flutterwave.isDemo && dealerNgnChanged) {
      try {
        const planId = await this.flutterwave.createPaymentPlan(next.dealerNgnAmount);
        await this.prisma.billingConfig.update({
          where: { id: SINGLETON_ID },
          data: { dealerFlwPlanId: planId },
        });
        this.bustCache();
      } catch (err) {
        warnings.push(
          `Saved, but a new Flutterwave dealer plan was not created: ${String((err as Error).message ?? err)}.`,
        );
      }
    }

    return { warnings };
  }
}

function normaliseCurrencyOptions(input: Record<string, unknown>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [rawKey, rawVal] of Object.entries(input ?? {})) {
    const key = String(rawKey).trim().toLowerCase();
    if (!/^[a-z]{3}$/.test(key)) {
      throw new BadRequestException(`"${rawKey}" is not a valid 3-letter currency code.`);
    }
    const val = Number(rawVal);
    if (!Number.isInteger(val) || val < 1 || val > 100_000_000) {
      throw new BadRequestException(`Amount for ${key} must be a positive integer in minor units.`);
    }
    out[key] = val;
  }
  return out;
}
