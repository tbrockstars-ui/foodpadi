import { Body, Controller, ForbiddenException, Headers, HttpCode, Logger, Post } from '@nestjs/common';
import { FlutterwaveService } from '../billing/flutterwave.service';
import { DealerSubscriptionService } from './dealer-subscription.service';

/**
 * Flutterwave webhook receiver for the Food Dealer Network subscription (the
 * Nigeria journey). Shares the same `verif-hash` shared-secret check as the
 * Premium Flutterwave webhook (FLW_SECRET_HASH — one hash per Flutterwave
 * account), but a separate route and its own `charge.completed` re-verification
 * against the DEALER plan amount so a Premium charge can never be applied here.
 */
@Controller('dealers/billing/flutterwave')
export class DealerFlutterwaveWebhookController {
  private readonly logger = new Logger(DealerFlutterwaveWebhookController.name);

  constructor(
    private readonly flutterwave: FlutterwaveService,
    private readonly dealerSubscriptions: DealerSubscriptionService,
  ) {}

  @Post('webhook')
  @HttpCode(200)
  async handle(
    @Headers('verif-hash') verifHash: string | undefined,
    @Body() payload: { event?: string; data?: Record<string, unknown> },
  ): Promise<{ received: true }> {
    if (!this.flutterwave.verifyWebhookSignature(verifHash)) {
      this.logger.warn('Dealer Flutterwave webhook rejected: bad or missing verif-hash.');
      throw new ForbiddenException('Invalid webhook signature.');
    }
    await this.dealerSubscriptions.handleFlutterwaveWebhook(payload ?? {});
    return { received: true };
  }
}
