import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import Stripe from 'stripe';

const DEMO_SESSION_PREFIX = 'cs_demo_';
const DEMO_SUBSCRIPTION_PREFIX = 'sub_demo_';
const DEMO_PRICE_ID = 'price_demo';

interface DemoSessionPayload {
  userId: string;
  customerId: string;
}

/**
 * Thin wrapper around the Stripe SDK. The client is created lazily so the API
 * still boots (and every non-billing feature keeps working) when no Stripe key
 * is configured — the same "degrade cleanly without a third-party key" posture
 * ClaudeService uses for ANTHROPIC_API_KEY. Any billing endpoint hit without a
 * key returns a clean 503 rather than a crash.
 *
 * DEMO MODE (`STRIPE_DEMO_MODE=true`, same precedent as `FLW_DEMO_MODE`): the
 * whole Premium subscribe/manage/cancel journey works with no Stripe account
 * and no real card. `createCheckoutSession` points at a local demo checkout
 * page and `createPortalSession` at a local demo portal page; the "session"
 * and "subscription" objects that flow back through `retrieveCheckoutSession`/
 * `retrieveSubscription` are synthesised locally (the user id and demo
 * customer id are encoded in the session id itself, so nothing needs a DB row
 * to round-trip). Nothing ever leaves the server. Meant for MVP demos / UX
 * validation only.
 */
@Injectable()
export class StripeService {
  private readonly logger = new Logger(StripeService.name);
  private cachedClient: Stripe | null = null;

  get isDemo(): boolean {
    return process.env.STRIPE_DEMO_MODE === 'true';
  }

  get isConfigured(): boolean {
    if (this.isDemo) return true;
    return Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_PRICE_ID);
  }

  private get client(): Stripe {
    if (this.cachedClient) return this.cachedClient;
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) {
      throw new ServiceUnavailableException('Payments are not configured on this server.');
    }
    this.cachedClient = new Stripe(key, {
      // Pin nothing — the SDK uses its bundled API version, which matches the
      // types this package ships with.
      appInfo: { name: 'FoodPadi', url: 'https://foodpadi.app' },
      maxNetworkRetries: 2,
    });
    return this.cachedClient;
  }

  get priceId(): string {
    if (this.isDemo) return process.env.STRIPE_PRICE_ID || DEMO_PRICE_ID;
    const id = process.env.STRIPE_PRICE_ID;
    if (!id) throw new ServiceUnavailableException('Payments are not configured on this server.');
    return id;
  }

  // --- Demo helpers ---------------------------------------------------------

  private static encodeDemoSession(payload: DemoSessionPayload): string {
    return DEMO_SESSION_PREFIX + Buffer.from(JSON.stringify(payload)).toString('base64url');
  }

  private static decodeDemoSession(sessionId: string): DemoSessionPayload | null {
    if (!sessionId.startsWith(DEMO_SESSION_PREFIX)) return null;
    try {
      const json = Buffer.from(
        sessionId.slice(DEMO_SESSION_PREFIX.length),
        'base64url',
      ).toString('utf8');
      const parsed = JSON.parse(json) as Partial<DemoSessionPayload>;
      if (!parsed.userId || !parsed.customerId) return null;
      return { userId: parsed.userId, customerId: parsed.customerId };
    } catch {
      return null;
    }
  }

  /** A synthetic, always-active demo subscription for one demo customer. */
  private demoSubscription(customerId: string): Stripe.Subscription {
    const now = Math.floor(Date.now() / 1000);
    return {
      id: `${DEMO_SUBSCRIPTION_PREFIX}${customerId}`,
      object: 'subscription',
      status: 'active',
      customer: customerId,
      items: { object: 'list', data: [{ price: { id: this.priceId } }] },
      current_period_end: now + 30 * 24 * 60 * 60,
      cancel_at_period_end: false,
      canceled_at: null,
      trial_end: null,
      metadata: {},
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any as Stripe.Subscription;
  }

  get productId(): string | null {
    return process.env.STRIPE_PRODUCT_ID ?? null;
  }

  /** minor-unit map { gbp: 449 } -> Stripe's currency_options shape. */
  private static toCurrencyOptions(
    opts: Record<string, number>,
  ): Record<string, { unit_amount: number }> {
    const out: Record<string, { unit_amount: number }> = {};
    for (const [ccy, amount] of Object.entries(opts ?? {})) {
      out[ccy.toLowerCase()] = { unit_amount: amount };
    }
    return out;
  }

  /** Update the presentment amounts on an existing Price (currency_options IS mutable). */
  async updatePriceCurrencyOptions(
    priceId: string,
    currencyOptions: Record<string, number>,
  ): Promise<void> {
    await this.client.prices.update(priceId, {
      currency_options: StripeService.toCurrencyOptions(currencyOptions),
    });
  }

  /**
   * A Price's `unit_amount` is immutable, so changing the base price means
   * creating a new Price on the same Product, archiving the old one, and
   * returning the new id for BillingConfig to store. Existing subscriptions
   * keep their original price (standard SaaS behaviour); new checkouts use this.
   */
  async createReplacementPrice(params: {
    unitAmount: number;
    currency: string;
    currencyOptions: Record<string, number>;
    archivePriceId?: string | null;
  }): Promise<string> {
    let productId = this.productId;
    if (!productId) {
      // Derive it from the current price if STRIPE_PRODUCT_ID wasn't set.
      const current = await this.client.prices.retrieve(this.priceId);
      productId = typeof current.product === 'string' ? current.product : current.product.id;
    }
    const created = await this.client.prices.create({
      product: productId,
      currency: params.currency,
      unit_amount: params.unitAmount,
      recurring: { interval: 'month' },
      currency_options: StripeService.toCurrencyOptions(params.currencyOptions),
      metadata: { foodpadi_key: 'foodpadi_premium' },
    });
    if (params.archivePriceId && params.archivePriceId !== created.id) {
      await this.client.prices
        .update(params.archivePriceId, { active: false })
        .catch((err) => this.logger.warn(`Could not archive old price ${params.archivePriceId}: ${err}`));
    }
    return created.id;
  }

  /** First entry of WEB_APP_URL (comma-separated list) — where Checkout returns to. */
  get webAppUrl(): string {
    const raw = process.env.WEB_APP_URL ?? 'http://localhost:3100';
    return raw.split(',')[0].trim().replace(/\/$/, '');
  }

  async getOrCreateCustomer(params: {
    userId: string;
    email: string;
    existingCustomerId?: string | null;
  }): Promise<string> {
    if (params.existingCustomerId) return params.existingCustomerId;
    if (this.isDemo) {
      const customerId = `cus_demo_${params.userId}`;
      this.logger.log(`STRIPE_DEMO_MODE: synthesising customer ${customerId}`);
      return customerId;
    }
    const created = await this.client.customers.create({
      email: params.email,
      metadata: { foodpadiUserId: params.userId },
    });
    return created.id;
  }

  async createCheckoutSession(params: {
    customerId: string;
    userId: string;
    successUrl: string;
    cancelUrl: string;
    /** Effective price id (BillingConfig override, else env). */
    priceId?: string;
    /** Effective trial length (BillingConfig, else env STRIPE_TRIAL_DAYS). */
    trialDays?: number;
    /** Display-only, for the local demo checkout page. Ignored when live. */
    amountCents?: number;
    currency?: string;
  }): Promise<Stripe.Checkout.Session> {
    if (this.isDemo) {
      const sessionId = StripeService.encodeDemoSession({
        userId: params.userId,
        customerId: params.customerId,
      });
      const url = new URL(`${this.webAppUrl}/premium/stripe-demo-checkout`);
      url.searchParams.set('session_id', sessionId);
      if (params.amountCents != null) url.searchParams.set('amount', String(params.amountCents));
      if (params.currency) url.searchParams.set('currency', params.currency);
      this.logger.log(`STRIPE_DEMO_MODE: returning local demo checkout for user ${params.userId}`);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return { id: sessionId, url: url.toString() } as any as Stripe.Checkout.Session;
    }
    const trialDays =
      params.trialDays ?? Number.parseInt(process.env.STRIPE_TRIAL_DAYS ?? '', 10);
    const automaticTax = process.env.STRIPE_AUTOMATIC_TAX === 'true';

    return this.client.checkout.sessions.create({
      mode: 'subscription',
      customer: params.customerId,
      // No `currency` — leaving it unset lets Stripe Adaptive Pricing present
      // the customer's local currency where the account/method supports it,
      // and fall back to USD where it does not.
      line_items: [{ price: params.priceId ?? this.priceId, quantity: 1 }],
      client_reference_id: params.userId,
      metadata: { foodpadiUserId: params.userId },
      subscription_data: {
        metadata: { foodpadiUserId: params.userId },
        ...(Number.isFinite(trialDays) && trialDays > 0
          ? { trial_period_days: trialDays }
          : {}),
      },
      allow_promotion_codes: true,
      billing_address_collection: 'auto',
      ...(automaticTax
        ? {
            automatic_tax: { enabled: true },
            customer_update: { address: 'auto', name: 'auto' },
          }
        : {}),
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
    });
  }

  createPortalSession(params: {
    customerId: string;
    returnUrl: string;
  }): Promise<Stripe.BillingPortal.Session> {
    if (this.isDemo) {
      this.logger.log(`STRIPE_DEMO_MODE: returning local demo portal for ${params.customerId}`);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return Promise.resolve({
        url: `${this.webAppUrl}/premium/stripe-demo-portal`,
      } as any as Stripe.BillingPortal.Session);
    }
    return this.client.billingPortal.sessions.create({
      customer: params.customerId,
      return_url: params.returnUrl,
      ...(process.env.STRIPE_PORTAL_CONFIGURATION_ID
        ? { configuration: process.env.STRIPE_PORTAL_CONFIGURATION_ID }
        : {}),
    });
  }

  retrieveCheckoutSession(sessionId: string): Promise<Stripe.Checkout.Session> {
    const demo = this.isDemo ? StripeService.decodeDemoSession(sessionId) : null;
    if (demo) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return Promise.resolve({
        id: sessionId,
        client_reference_id: demo.userId,
        metadata: { foodpadiUserId: demo.userId },
        customer: { id: demo.customerId },
        subscription: this.demoSubscription(demo.customerId),
      } as any as Stripe.Checkout.Session);
    }
    return this.client.checkout.sessions.retrieve(sessionId, {
      expand: ['subscription', 'customer'],
    });
  }

  retrieveSubscription(subscriptionId: string): Promise<Stripe.Subscription> {
    if (this.isDemo && subscriptionId.startsWith(DEMO_SUBSCRIPTION_PREFIX)) {
      return Promise.resolve(
        this.demoSubscription(subscriptionId.slice(DEMO_SUBSCRIPTION_PREFIX.length)),
      );
    }
    return this.client.subscriptions.retrieve(subscriptionId);
  }

  /** The canonical Price with its per-currency presentment amounts expanded. */
  retrievePriceWithCurrencyOptions(): Promise<Stripe.Price> {
    return this.client.prices.retrieve(this.priceId, {
      expand: ['currency_options'],
    });
  }

  constructWebhookEvent(rawBody: Buffer | string, signature: string): Stripe.Event {
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!secret) {
      throw new ServiceUnavailableException('Webhook secret is not configured.');
    }
    return this.client.webhooks.constructEvent(rawBody, signature, secret);
  }

  // -------------------------------------------------------------------------
  // FoodPadi Food Dealer Network — a SEPARATE subscription product from
  // Premium (dealer brief §13). These mirror the user-facing checkout methods
  // above but carry a dealerId (in `client_reference_id` + `metadata
  // .foodpadiDealerId`) instead of a userId, use their own Price
  // (STRIPE_DEALER_PRICE_ID) and webhook secret (STRIPE_DEALER_WEBHOOK_SECRET),
  // and default to the dealer demo pages. Kept as their own methods so the
  // Premium path is left completely untouched.

  private static readonly DEALER_DEMO_SESSION_PREFIX = 'dcs_demo_';

  get dealerPriceId(): string {
    const id = process.env.STRIPE_DEALER_PRICE_ID;
    if (this.isDemo) return id || 'price_dealer_demo';
    if (!id) throw new ServiceUnavailableException('Dealer subscriptions are not configured on this server.');
    return id;
  }

  private static encodeDealerDemoSession(p: { dealerId: string; customerId: string }): string {
    return (
      StripeService.DEALER_DEMO_SESSION_PREFIX +
      Buffer.from(JSON.stringify(p)).toString('base64url')
    );
  }

  private static decodeDealerDemoSession(
    sessionId: string,
  ): { dealerId: string; customerId: string } | null {
    if (!sessionId.startsWith(StripeService.DEALER_DEMO_SESSION_PREFIX)) return null;
    try {
      const json = Buffer.from(
        sessionId.slice(StripeService.DEALER_DEMO_SESSION_PREFIX.length),
        'base64url',
      ).toString('utf8');
      const parsed = JSON.parse(json) as Partial<{ dealerId: string; customerId: string }>;
      if (!parsed.dealerId || !parsed.customerId) return null;
      return { dealerId: parsed.dealerId, customerId: parsed.customerId };
    } catch {
      return null;
    }
  }

  async createDealerCheckoutSession(params: {
    customerId: string;
    dealerId: string;
    priceId?: string;
    successUrl: string;
    cancelUrl: string;
    /** Display-only, for the local demo checkout page. Ignored when live. */
    amountCents?: number;
    currency?: string;
  }): Promise<{ id: string; url: string }> {
    if (this.isDemo) {
      const id = StripeService.encodeDealerDemoSession({
        dealerId: params.dealerId,
        customerId: params.customerId,
      });
      // The demo checkout page is served by our OWN web app, so return a
      // relative path — the browser resolves it against whatever origin the
      // dealer is already on (dev web runs on 3000/3100/3200 interchangeably).
      // WEB_APP_URL only matters for the real provider-hosted redirect below.
      const qs = new URLSearchParams({ session_id: id });
      if (params.amountCents != null) qs.set('amount', String(params.amountCents));
      if (params.currency) qs.set('currency', params.currency);
      this.logger.log(`STRIPE_DEMO_MODE: returning local dealer demo checkout for dealer ${params.dealerId}`);
      return { id, url: `/dealers/onboarding/demo-checkout?${qs.toString()}` };
    }
    const automaticTax = process.env.STRIPE_AUTOMATIC_TAX === 'true';
    const session = await this.client.checkout.sessions.create({
      mode: 'subscription',
      customer: params.customerId,
      line_items: [{ price: params.priceId ?? this.dealerPriceId, quantity: 1 }],
      client_reference_id: params.dealerId,
      metadata: { foodpadiDealerId: params.dealerId },
      subscription_data: { metadata: { foodpadiDealerId: params.dealerId } },
      allow_promotion_codes: true,
      billing_address_collection: 'auto',
      ...(automaticTax
        ? { automatic_tax: { enabled: true }, customer_update: { address: 'auto', name: 'auto' } }
        : {}),
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
    });
    if (!session.url) {
      throw new ServiceUnavailableException('Stripe did not return a checkout URL.');
    }
    return { id: session.id, url: session.url };
  }

  retrieveDealerCheckoutSession(sessionId: string): Promise<Stripe.Checkout.Session> {
    const demo = this.isDemo ? StripeService.decodeDealerDemoSession(sessionId) : null;
    if (demo) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return Promise.resolve({
        id: sessionId,
        client_reference_id: demo.dealerId,
        metadata: { foodpadiDealerId: demo.dealerId },
        customer: { id: demo.customerId },
        subscription: this.demoSubscription(demo.customerId),
      } as any as Stripe.Checkout.Session);
    }
    return this.client.checkout.sessions.retrieve(sessionId, {
      expand: ['subscription', 'customer'],
    });
  }

  constructDealerWebhookEvent(rawBody: Buffer | string, signature: string): Stripe.Event {
    const secret = process.env.STRIPE_DEALER_WEBHOOK_SECRET;
    if (!secret) {
      throw new ServiceUnavailableException('Dealer webhook secret is not configured.');
    }
    return this.client.webhooks.constructEvent(rawBody, signature, secret);
  }

  /**
   * A Stripe Price's `unit_amount` is immutable, so an admin dealer-price change
   * mints a new Price on the dealer Product and archives the old one — same
   * pattern as `createReplacementPrice` for Premium. Returns the new price id
   * for BillingConfig to store in `dealerStripePriceId`.
   */
  async createReplacementDealerPrice(params: {
    unitAmount: number;
    currency: string;
    archivePriceId?: string | null;
  }): Promise<string> {
    let productId = process.env.STRIPE_DEALER_PRODUCT_ID ?? null;
    if (!productId) {
      const current = await this.client.prices.retrieve(this.dealerPriceId);
      productId = typeof current.product === 'string' ? current.product : current.product.id;
    }
    const created = await this.client.prices.create({
      product: productId,
      currency: params.currency,
      unit_amount: params.unitAmount,
      recurring: { interval: 'month' },
      metadata: { foodpadi_key: 'foodpadi_food_dealer' },
    });
    if (params.archivePriceId && params.archivePriceId !== created.id) {
      await this.client.prices
        .update(params.archivePriceId, { active: false })
        .catch((err) =>
          this.logger.warn(`Could not archive old dealer price ${params.archivePriceId}: ${err}`),
        );
    }
    return created.id;
  }
}
