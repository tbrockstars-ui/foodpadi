import { Injectable } from '@nestjs/common';
import type { DealerSubscription } from '@prisma/client';
import type { DealerSubscriptionStatus } from '@foodpadi/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { BillingConfigService } from '../billing/billing-config.service';

// Statuses a provider reports while the dealer subscription is genuinely
// paid-for. Same set as the Premium model's PREMIUM_STATUSES.
const ACTIVE_STATUSES = new Set<string>(['active', 'trialing']);

export interface DealerEntitlement {
  /** The single "is this dealer paid-up" answer — includes the past_due grace window. */
  active: boolean;
  status: DealerSubscriptionStatus;
}

function graceDaysFromEnv(): number | undefined {
  // Dealers reuse the Premium dunning window unless a dealer-specific override
  // is set. STRIPE_PAST_DUE_GRACE_DAYS (the Premium ops escape hatch) still
  // applies as a last resort so both products behave the same by default.
  const raw = process.env.DEALER_PAST_DUE_GRACE_DAYS ?? process.env.STRIPE_PAST_DUE_GRACE_DAYS;
  if (raw === undefined || raw === '') return undefined;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

/**
 * The ONE authoritative "is this dealer's subscription active" check — the
 * dealer-side counterpart of billing/EntitlementService (mirrors its
 * grace-window and cancel-at-period-end rules exactly, docs/SUBSCRIPTION_MODEL.md
 * §15). Every gate that depends on the dealer paying — the search engine's
 * `subscriptionActive` flag, the portal subscription view, `GET /dealers/:slug`
 * — resolves through here so there is never a second opinion.
 *
 * Expiry policy (dealer brief §25): once this returns `active: false` for a
 * dealer that WAS active, the listing is removed from all customer search
 * (Featured and organic) and the public profile 404s. Data is retained; a
 * renewal that flips a status back to `active` restores the listing with no
 * duplicate rows.
 */
@Injectable()
export class DealerEntitlementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: BillingConfigService,
  ) {}

  private async resolveGraceDays(): Promise<number> {
    const fromEnv = graceDaysFromEnv();
    if (fromEnv !== undefined) return fromEnv;
    return (await this.config.getResolved()).pastDueGraceDays;
  }

  async isActive(dealerId: string): Promise<boolean> {
    const [row, graceDays] = await Promise.all([
      this.prisma.dealerSubscription.findUnique({ where: { dealerId } }),
      this.resolveGraceDays(),
    ]);
    return this.computeEntitlement(row, graceDays).active;
  }

  async getEntitlement(dealerId: string): Promise<DealerEntitlement> {
    const [row, graceDays] = await Promise.all([
      this.prisma.dealerSubscription.findUnique({ where: { dealerId } }),
      this.resolveGraceDays(),
    ]);
    return this.computeEntitlement(row, graceDays);
  }

  /**
   * Pure status → entitlement rule (no I/O), so it is trivially unit-testable.
   *
   *  - active / trialing                 → active
   *  - cancel-at-period-end, period not  → still active until the paid period
   *    yet ended                            actually ends (a voluntary cancel
   *                                         keeps exactly what was paid for —
   *                                         no dunning grace)
   *  - past_due, within currentPeriodEnd → active during the grace window, so a
   *    + graceDays                          failed renewal doesn't drop the
   *                                         listing instantly while the retry runs
   *  - canceled / unpaid / incomplete /  → not active → listing removed from
   *    incomplete_expired / paused          customer search (brief §25)
   */
  computeEntitlement(row: DealerSubscription | null, graceDays?: number): DealerEntitlement {
    if (!row) return { active: false, status: 'none' };

    const status = row.status as DealerSubscriptionStatus;

    if (ACTIVE_STATUSES.has(row.status)) {
      if (
        row.cancelAtPeriodEnd &&
        row.currentPeriodEnd &&
        row.currentPeriodEnd.getTime() <= Date.now()
      ) {
        return { active: false, status };
      }
      return { active: true, status };
    }

    if (row.status === 'past_due') {
      const grace = graceDays ?? graceDaysFromEnv() ?? 0;
      if (grace > 0 && row.currentPeriodEnd) {
        const graceEnd = new Date(row.currentPeriodEnd.getTime() + grace * 86_400_000);
        return { active: graceEnd.getTime() > Date.now(), status };
      }
    }

    return { active: false, status };
  }
}
