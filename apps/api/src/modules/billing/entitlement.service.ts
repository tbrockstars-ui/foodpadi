import { Injectable } from '@nestjs/common';
import type { Subscription } from '@prisma/client';
import type {
  PaymentProvider,
  SubscriptionStatus,
  SubscriptionView,
  UserEntitlement,
} from '@foodpadi/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { BillingConfigService } from './billing-config.service';

// Statuses Stripe reports while the subscription is genuinely paid-for.
const PREMIUM_STATUSES = new Set<string>(['active', 'trialing']);

export interface Entitlement {
  premium: boolean;
  status: SubscriptionStatus;
}

export type { UserEntitlement };

/**
 * Payment-failure grace / dunning window, in days. `STRIPE_PAST_DUE_GRACE_DAYS`
 * (an ops escape hatch) overrides the admin-tunable `billing_config` value when
 * it is set to a valid number. Returns undefined when the env var is unset or
 * junk, so the caller falls back to the config value.
 */
function graceDaysFromEnv(): number | undefined {
  const raw = process.env.STRIPE_PAST_DUE_GRACE_DAYS;
  if (raw === undefined || raw === '') return undefined;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

/**
 * The ONE authoritative entitlement check (docs/SUBSCRIPTION_MODEL.md §15:
 * "a single server-side entitlement check reused across every gated endpoint").
 * Every premium gate — PremiumGuard, the /billing/subscription view, any future
 * per-feature check — resolves through here so there is never a second opinion
 * on whether a user is premium.
 */
@Injectable()
export class EntitlementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: BillingConfigService,
  ) {}

  /** Effective dunning window: env override, else the admin-tunable config value. */
  private async resolveGraceDays(): Promise<number> {
    const fromEnv = graceDaysFromEnv();
    if (fromEnv !== undefined) return fromEnv;
    return (await this.config.getResolved()).pastDueGraceDays;
  }

  async isPremium(userId: string): Promise<boolean> {
    const [row, graceDays] = await Promise.all([
      this.prisma.subscription.findUnique({ where: { userId } }),
      this.resolveGraceDays(),
    ]);
    return this.computeEntitlement(row, graceDays).premium;
  }

  async getEntitlement(userId: string): Promise<Entitlement> {
    const [row, graceDays] = await Promise.all([
      this.prisma.subscription.findUnique({ where: { userId } }),
      this.resolveGraceDays(),
    ]);
    return this.computeEntitlement(row, graceDays);
  }

  /** Fetches the row + effective grace window and renders the client view. */
  async getSubscriptionView(userId: string): Promise<SubscriptionView> {
    const [row, graceDays] = await Promise.all([
      this.prisma.subscription.findUnique({ where: { userId } }),
      this.resolveGraceDays(),
    ]);
    return this.toView(row, graceDays);
  }

  /**
   * The three-state access tier for the Guest/Trial/Paid model. Entitlement is
   * independent of authentication — a registered user whose in-app trial has
   * lapsed without subscribing resolves to `guest` (their account and data are
   * untouched; AI is simply off). Trial expiry is evaluated lazily here on
   * every read — there is no scheduled job and nothing is written.
   *
   *  - active/trialing subscription (verified webhook)          → 'paid'
   *  - otherwise, UserProfile.trialEndsAt still in the future    → 'trial'
   *  - otherwise (no trial, expired trial, or lapsed sub)        → 'guest'
   */
  async getUserEntitlement(userId: string): Promise<UserEntitlement> {
    if (await this.isPremium(userId)) return 'paid';
    const profile = await this.prisma.userProfile.findUnique({
      where: { userId },
      select: { trialEndsAt: true },
    });
    if (profile?.trialEndsAt && profile.trialEndsAt.getTime() > Date.now()) {
      return 'trial';
    }
    return 'guest';
  }

  /**
   * Pure status → entitlement rule (no I/O), so it is trivially unit-testable.
   * `graceDays` is the payment-failure dunning window; callers resolve it from
   * config/env via `resolveGraceDays()` and pass it in. When omitted it falls
   * back to the env var, then 0 — so any direct/legacy caller keeps working.
   *
   *  - active / trialing            → premium
   *  - "cancel at period end"       → still `active` in Stripe until the period
   *                                   actually ends, so premium stays true and
   *                                   the paid period is honoured automatically.
   *                                   No dunning grace here — a voluntary cancel
   *                                   gets exactly the period that was paid for.
   *  - past_due                     → premium during the grace window
   *                                   (currentPeriodEnd + graceDays), so a
   *                                   failed renewal doesn't drop the user
   *                                   instantly while the retry runs.
   *  - canceled / unpaid / incomplete / paused → not premium
   */
  computeEntitlement(row: Subscription | null, graceDays?: number): Entitlement {
    if (!row) return { premium: false, status: 'none' };

    const status = row.status as SubscriptionStatus;
    if (PREMIUM_STATUSES.has(row.status)) {
      // "Cancel at period end" keeps access until the paid period actually
      // ends. Stripe flips status to "canceled" via a webhook when that
      // happens; Flutterwave has no such delayed event, so enforce it here
      // too — once the period has passed, a cancelled subscription is done.
      if (
        row.cancelAtPeriodEnd &&
        row.currentPeriodEnd &&
        row.currentPeriodEnd.getTime() <= Date.now()
      ) {
        return { premium: false, status };
      }
      return { premium: true, status };
    }

    if (row.status === 'past_due') {
      const grace = graceDays ?? graceDaysFromEnv() ?? 0;
      if (grace > 0 && row.currentPeriodEnd) {
        const graceEnd = new Date(row.currentPeriodEnd.getTime() + grace * 86_400_000);
        return { premium: graceEnd.getTime() > Date.now(), status };
      }
    }

    return { premium: false, status };
  }

  toView(row: Subscription | null, graceDays?: number): SubscriptionView {
    const { premium, status } = this.computeEntitlement(row, graceDays);
    const provider = (row?.provider as PaymentProvider) ?? 'stripe';
    return {
      premium,
      plan: premium ? 'premium' : 'free',
      status,
      provider,
      base: {
        amountCents: row?.basePriceCents ?? 499,
        currency: row?.baseCurrency ?? 'usd',
      },
      presentment:
        row?.presentmentAmountCents != null && row.presentmentCurrency
          ? { amountCents: row.presentmentAmountCents, currency: row.presentmentCurrency }
          : null,
      billingInterval: row?.billingInterval ?? 'month',
      currentPeriodEnd: row?.currentPeriodEnd?.toISOString() ?? null,
      cancelAtPeriodEnd: row?.cancelAtPeriodEnd ?? false,
      canceledAt: row?.canceledAt?.toISOString() ?? null,
      trialEndsAt: row?.trialEndsAt?.toISOString() ?? null,
      customerCountry: row?.customerCountry ?? null,
      // Stripe subs open the hosted portal; Flutterwave has no portal, so those
      // are cancelled in-app instead.
      canManage: provider === 'stripe' && Boolean(row?.stripeCustomerId),
      canCancel:
        provider === 'flutterwave' &&
        Boolean(row?.flwSubscriptionId) &&
        premium &&
        !(row?.cancelAtPeriodEnd ?? false),
    };
  }
}
