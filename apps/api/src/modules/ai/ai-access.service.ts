import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { BillingConfigService } from '../billing/billing-config.service';
import { EntitlementService } from '../billing/entitlement.service';

/**
 * The ONE server-side gate for "may this user trigger a paid AI call?"
 * (Guest/Trial/Paid model — docs/SUBSCRIPTION_MODEL.md). Every service method
 * that calls ClaudeService invokes `assertCanUseAi(userId, feature)` immediately
 * before it, so the rule cannot be bypassed by calling an endpoint directly:
 *
 *   paid  → allowed, unmetered
 *   trial → allowed until BillingConfig.trialAiLimit total calls, then blocked
 *   guest → blocked (covers a registered user whose trial has ended)
 *
 * Anonymous guests never reach here — the AI endpoints are all behind
 * JwtAuthGuard or branch to a curated, non-AI path for `actor.type === 'guest'`
 * before this is called. So a `guest` result here always means "registered,
 * trial over, not subscribed".
 */
@Injectable()
export class AiAccessService {
  private readonly logger = new Logger(AiAccessService.name);

  constructor(
    private readonly entitlements: EntitlementService,
    private readonly billingConfig: BillingConfigService,
    private readonly prisma: PrismaService,
    private readonly analytics: AnalyticsService,
  ) {}

  async assertCanUseAi(userId: string, feature: string): Promise<void> {
    const entitlement = await this.entitlements.getUserEntitlement(userId);

    if (entitlement === 'paid') return;

    if (entitlement === 'guest') {
      void this.analytics.track('guest_ai_blocked', { userId }, { feature });
      throw new HttpException(
        {
          message: 'Your FoodPadi trial has ended. Subscribe to keep using FoodPadi AI.',
          code: 'AI_ACCESS_DENIED',
          reason: 'GUEST',
        },
        HttpStatus.PAYMENT_REQUIRED,
      );
    }

    // Trial: meter against the admin-tunable cap. Increment-then-check so
    // concurrent calls can't slip past the limit; the counter simply settles
    // at limit+1 once exhausted.
    const { trialAiLimit } = await this.billingConfig.getResolved();
    const { trialAiUsedCount } = await this.prisma.userProfile.update({
      where: { userId },
      data: { trialAiUsedCount: { increment: 1 } },
      select: { trialAiUsedCount: true },
    });

    if (trialAiUsedCount > trialAiLimit) {
      void this.analytics.track('trial_ai_limit_reached', { userId }, { feature, limit: trialAiLimit });
      throw new HttpException(
        {
          message: `You've used all ${trialAiLimit} trial AI requests. Subscribe for unlimited FoodPadi AI.`,
          code: 'AI_TRIAL_LIMIT_REACHED',
        },
        HttpStatus.PAYMENT_REQUIRED,
      );
    }

    void this.analytics.track('trial_ai_used', { userId }, {
      feature,
      used: trialAiUsedCount,
      limit: trialAiLimit,
    });
  }
}
