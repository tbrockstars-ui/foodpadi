import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

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

  constructor(private readonly prisma: PrismaService) {}

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
  }
}
