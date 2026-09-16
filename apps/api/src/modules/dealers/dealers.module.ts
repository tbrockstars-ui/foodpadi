import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { BillingModule } from '../billing/billing.module';
import { AnalyticsModule } from '../analytics/analytics.module';
import { MailerService } from '../../common/mailer.service';
import { DealerEntitlementService } from './dealer-entitlement.service';
import { DealerSearchProfileService } from './dealer-search-profile.service';
import { DealerSubscriptionService } from './dealer-subscription.service';
import { DealerPortalService } from './dealer-portal.service';
import { DealerSearchService } from './dealer-search.service';
import { DealerAuditService } from './dealer-audit.service';
import { DealerBillingWebhookController } from './dealer-billing-webhook.controller';
import { DealerFlutterwaveWebhookController } from './dealer-flutterwave-webhook.controller';
import { DealerPortalController } from './dealer-portal.controller';
import {
  DealerSearchController,
  DealerPublicController,
  DealerRatingsController,
  DealerRatingsReadController,
} from './dealer-search.controller';
import { DealerRatingService } from './dealer-rating.service';

/**
 * FoodPadi Food Dealer Network (dealer brief) — a web-only B2B onboarding +
 * subscription + management product whose data is consumed by BOTH web and
 * mobile customer discovery.
 *
 * Built so far: the data model, the dealer subscription/entitlement engine (a
 * separate product from Premium — never shares the `subscriptions` row) with
 * its Stripe + Flutterwave webhooks, and the web-only onboarding + dashboard
 * portal (JWT + per-dealer ownership guarded). Reuses BillingModule's
 * StripeService / FlutterwaveService as-is.
 *
 * Later phases add the admin controls under AdminModule.
 *
 * Controller order matters: DealerPortalController (`dealers/me/*`) is
 * registered before DealerSearchController (`dealers/search`, `dealers/:slug`)
 * so the literal `me` / `search` / `billing` paths are never captured by the
 * `:slug` param route.
 */
@Module({
  imports: [AuthModule, BillingModule, AnalyticsModule],
  controllers: [
    DealerPortalController,
    DealerBillingWebhookController,
    DealerFlutterwaveWebhookController,
    DealerSearchController,
    DealerRatingsController,
    DealerRatingsReadController,
    DealerPublicController,
  ],
  providers: [
    DealerEntitlementService,
    DealerSearchProfileService,
    DealerSubscriptionService,
    DealerPortalService,
    DealerSearchService,
    DealerRatingService,
    DealerAuditService,
    MailerService,
  ],
  exports: [
    DealerEntitlementService,
    DealerSearchProfileService,
    DealerSubscriptionService,
    DealerSearchService,
    DealerRatingService,
    DealerAuditService,
    MailerService,
  ],
})
export class DealersModule {}
