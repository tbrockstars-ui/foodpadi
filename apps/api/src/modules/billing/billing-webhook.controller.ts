import {
  BadRequestException,
  Controller,
  HttpCode,
  Logger,
  Post,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { BillingService } from './billing.service';
import { StripeService } from './stripe.service';

/**
 * Stripe webhook receiver — deliberately UNAUTHENTICATED (Stripe calls it
 * server-to-server) and instead verified by signature. The raw request body is
 * required for `constructEvent`, so `/billing/webhook` is mounted with
 * `express.raw()` ahead of the JSON parser in main.ts; `req.body` here is a
 * Buffer, not parsed JSON.
 *
 * The server/webhook is the authoritative source of entitlement — the frontend
 * success page never grants Premium on its own (it only asks the API to sync).
 */
@Controller('billing')
export class BillingWebhookController {
  private readonly logger = new Logger(BillingWebhookController.name);

  constructor(
    private readonly billing: BillingService,
    private readonly stripe: StripeService,
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
      event = this.stripe.constructWebhookEvent(rawBody, signature);
    } catch (err) {
      this.logger.warn(`Webhook signature verification failed: ${String(err)}`);
      throw new BadRequestException('Webhook signature verification failed.');
    }

    await this.billing.handleWebhookEvent(event);
    return { received: true };
  }
}
