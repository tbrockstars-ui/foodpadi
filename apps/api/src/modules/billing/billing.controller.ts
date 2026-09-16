import {
  Body,
  Controller,
  Get,
  Headers,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import type {
  CheckoutSyncResponse,
  CreateCheckoutResponse,
  CreatePortalResponse,
  PricingView,
  SubscriptionView,
} from '@foodpadi/shared';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, CurrentUserPayload } from '../../common/current-user.decorator';
import { BillingService } from './billing.service';
import { CheckoutSyncDto } from './dto/checkout-sync.dto';
import { CreateCheckoutDto } from './dto/create-checkout.dto';
import { PricingQueryDto } from './dto/pricing-query.dto';
import { countryFromAcceptLanguage } from './country-currency';

@Controller('billing')
@UseGuards(JwtAuthGuard)
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  /** The authoritative entitlement + subscription detail for Settings → Subscription. */
  @Get('subscription')
  getSubscription(@CurrentUser() user: CurrentUserPayload): Promise<SubscriptionView> {
    return this.billing.getSubscriptionView(user.userId);
  }

  /**
   * Pre-checkout pricing: canonical $4.99 USD plus a provider-sourced local
   * amount where available (Stripe currency_options, or the Flutterwave NGN
   * plan for Nigeria). `country` is a hint (query param, else Accept-Language);
   * the provider's checkout stays authoritative for the charge. Also reports
   * which provider a checkout from here will use.
   */
  @Get('pricing')
  async getPricing(
    @CurrentUser() user: CurrentUserPayload,
    @Query() query: PricingQueryDto,
    @Headers('accept-language') acceptLanguage?: string,
  ): Promise<PricingView> {
    // Priority: explicit ?country= (e.g. the "pay in USD" fallback) >
    // the user's stored country of residence > the Accept-Language hint.
    const country =
      query.country ??
      (await this.billing.getStoredCountry(user.userId)) ??
      countryFromAcceptLanguage(acceptLanguage);
    return this.billing.getPricing(country);
  }

  /**
   * Opens hosted Checkout — Stripe by default, Flutterwave when `provider` is
   * 'flutterwave' (Nigeria). Returns { url, provider } for the client to
   * redirect to.
   */
  @Post('checkout')
  createCheckout(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CreateCheckoutDto,
  ): Promise<CreateCheckoutResponse> {
    // `dto.provider` may be absent — the service then falls back to the
    // provider implied by the user's stored country of residence.
    return this.billing.createCheckout({ userId: user.userId, email: user.email }, dto.provider);
  }

  /** Opens the Stripe billing customer portal (cancel, payment method, invoices). */
  @Post('portal')
  createPortal(@CurrentUser() user: CurrentUserPayload): Promise<CreatePortalResponse> {
    return this.billing.createPortal(user.userId);
  }

  /**
   * Cancel a subscription in-app — Flutterwave (no hosted portal at all) or a
   * demo Stripe subscription (no real portal to send them to). A real Stripe
   * subscription still cancels through the portal instead. Premium stays
   * active until the current paid period ends.
   */
  @Post('cancel')
  cancel(@CurrentUser() user: CurrentUserPayload): Promise<SubscriptionView> {
    return this.billing.cancelSubscription(user.userId);
  }

  /**
   * Called by the /premium/success page. Verifies the payment with the
   * provider and unlocks Premium immediately — idempotent with the webhook.
   */
  @Post('checkout/sync')
  syncCheckout(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CheckoutSyncDto,
  ): Promise<CheckoutSyncResponse> {
    return this.billing.syncCheckoutSession(
      { userId: user.userId, email: user.email },
      dto,
    );
  }
}
