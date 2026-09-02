import { Injectable, Logger, Optional } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ReferralsService } from '../referrals/referrals.service';
import { REFERRAL_QUALIFYING_EVENTS } from '../referrals/qualifying-events';

interface EventActor {
  userId?: string;
  guestSessionId?: string;
}

/**
 * Analytics is derived from real domain events, not a parallel tracking
 * SDK (docs/ANALYTICS_PLAN.md, docs/FOODPADI_ONBOARDING_ANALYTICS.md) — this
 * is the one place that writes to `food_events`; feature services call it
 * inline with whatever action just happened.
 */
@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(
    private readonly prisma: PrismaService,
    // Optional so AnalyticsService still works if the referrals feature is
    // absent (and so unit tests can construct it with just a Prisma mock).
    @Optional() private readonly referrals?: ReferralsService,
  ) {}

  async track(eventType: string, actor: EventActor, metadata?: Record<string, unknown>) {
    if (!actor.userId && !actor.guestSessionId) {
      this.logger.warn(`Dropped event "${eventType}" — no userId or guestSessionId given.`);
      return;
    }
    await this.prisma.foodEvent.create({
      data: {
        eventType,
        userId: actor.userId,
        guestSessionId: actor.guestSessionId,
        metadata: metadata as Prisma.InputJsonValue | undefined,
      },
    });

    // "Feed a Friend": a signed-in user doing something meaningful qualifies
    // whatever pending referral brought them here (docs/REFERRAL_PLAN.md §2.4).
    // Fire-and-forget — a referral bookkeeping error must never fail the
    // domain action that triggered this event.
    if (actor.userId && this.referrals && REFERRAL_QUALIFYING_EVENTS.has(eventType)) {
      this.referrals.markQualifiedIfPending(actor.userId).catch((err) => {
        this.logger.warn(`Referral qualification check failed: ${(err as Error).message}`);
      });
    }
  }
}
