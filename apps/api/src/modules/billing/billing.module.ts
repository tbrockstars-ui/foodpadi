import { Module } from '@nestjs/common';
import { BillingController } from './billing.controller';
import { BillingWebhookController } from './billing-webhook.controller';
import { FlutterwaveWebhookController } from './flutterwave-webhook.controller';
import { BillingService } from './billing.service';
import { BillingConfigService } from './billing-config.service';
import { FxRateService } from './fx-rate.service';
import { StripeService } from './stripe.service';
import { FlutterwaveService } from './flutterwave.service';
import { EntitlementService } from './entitlement.service';
import { PremiumGuard } from './premium.guard';

/**
 * FoodPadi Premium — Stripe Billing + hosted Checkout (default) and Flutterwave
 * (Nigeria), with the `subscriptions` table as the single source of truth for
 * entitlement and `billing_config` as the admin-tunable business values (price,
 * trial, per-currency amounts, NG price).
 *
 * Exports `EntitlementService` + `PremiumGuard` (feature gating — no route is
 * gated yet) and `BillingConfigService` (the admin dashboard reads/writes it
 * via AdminBillingController).
 */
@Module({
  controllers: [BillingController, BillingWebhookController, FlutterwaveWebhookController],
  providers: [
    BillingService,
    BillingConfigService,
    FxRateService,
    StripeService,
    FlutterwaveService,
    EntitlementService,
    PremiumGuard,
  ],
  // StripeService + FlutterwaveService are exported for the Food Dealer Network
  // (apps/api/src/modules/dealers), which reuses the low-level provider clients
  // for its own separate subscription product (dealer brief §13).
  exports: [
    EntitlementService,
    PremiumGuard,
    BillingConfigService,
    FxRateService,
    StripeService,
    FlutterwaveService,
  ],
})
export class BillingModule {}
