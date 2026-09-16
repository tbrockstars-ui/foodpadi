import { BadRequestException, Controller, HttpCode, Logger, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { StripeService } from '../billing/stripe.service';
import { DealerSubscriptionService } from './dealer-subscription.service';

/**
 * Stripe webhook receiver for the Food Dealer Network subscription — a SEPARATE
 * endpoint and signing secret (STRIPE_DEALER_WEBHOOK_SECRET) from the Premium
 * `/billing/webhook`, so the two products never cross-contaminate (dealer brief
 * §13). Unauthenticated (Stripe calls it server-to-server) and verified by
 * signature; the raw body is required, so this path is mounted with
 * `express.raw()` ahead of the JSON parser in main.ts.
 */
@Controller('dealers/billing')
export class DealerBillingWebhookController {
  private readonly logger = new Logger(DealerBillingWebhookController.name);

  constructor(
    private readonly stripe: StripeService,
    private readonly dealerSubscriptions: DealerSubscriptionService,
  ) {}

  @Post('webhook')
  @HttpCode(200)
  async handle(@Req() req: Request): Promise<{ received: true }> {
    const signature = req.headers['stripe-signature'];
    const rawBody = (req as unknown as { body?: Buffer }).body;

    if (!signature || typeof signature !== 'string') {
      throw new BadRequestException('Missing Stripe-Signature header.');
    }
    if (!Buffer.isBuffer(rawBody)) {
      throw new BadRequestException('Expected a raw request body.');
    }

    let event;
    try {
      event = this.stripe.constructDealerWebhookEvent(rawBody, signature);
    } catch (err) {
      this.logger.warn(`Dealer webhook signature verification failed: ${String(err)}`);
      throw new BadRequestException('Webhook signature verification failed.');
    }

    await this.dealerSubscriptions.handleStripeWebhook(event);
    return { received: true };
  }
}
