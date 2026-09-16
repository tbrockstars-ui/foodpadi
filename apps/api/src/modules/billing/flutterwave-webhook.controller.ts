import {
  Body,
  Controller,
  ForbiddenException,
  Headers,
  HttpCode,
  Logger,
  Post,
} from '@nestjs/common';
import { BillingService } from './billing.service';
import { FlutterwaveService } from './flutterwave.service';

/**
 * Flutterwave webhook receiver. Unauthenticated (Flutterwave calls it
 * server-to-server) and instead verified by the static `verif-hash` header
 * matching the dashboard "Secret hash" (FLW_SECRET_HASH). Unlike Stripe there
 * is no per-payload HMAC, so `charge.completed` never grants access on the
 * payload alone — BillingService re-verifies the transaction with Flutterwave
 * before writing anything. The server/webhook is the authoritative source of
 * entitlement.
 */
@Controller('billing/flutterwave')
export class FlutterwaveWebhookController {
  private readonly logger = new Logger(FlutterwaveWebhookController.name);

  constructor(
    private readonly billing: BillingService,
    private readonly flutterwave: FlutterwaveService,
  ) {}

  @Post('webhook')
  @HttpCode(200)
  async handle(
    @Headers('verif-hash') verifHash: string | undefined,
    @Body() payload: { event?: string; data?: Record<string, unknown> },
  ): Promise<{ received: true }> {
    if (!this.flutterwave.verifyWebhookSignature(verifHash)) {
      this.logger.warn('Flutterwave webhook rejected: bad or missing verif-hash.');
      throw new ForbiddenException('Invalid webhook signature.');
    }
    await this.billing.handleFlutterwaveWebhook(payload ?? {});
    return { received: true };
  }
}
