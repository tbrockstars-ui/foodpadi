import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Prisma, type Subscription } from '@prisma/client';
import type Stripe from 'stripe';
import type {
  CheckoutSyncRequest,
  CheckoutSyncResponse,
  CreateCheckoutResponse,
  PaymentProvider,
  PricingView,
  SubscriptionView,
} from '@foodpadi/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { StripeService } from './stripe.service';
import { FlutterwaveService } from './flutterwave.service';
import { EntitlementService } from './entitlement.service';
import { BillingConfigService } from './billing-config.service';
import { FxRateService } from './fx-rate.service';
import { currencyForCountry, isFlutterwaveCountry } from './country-currency';

// Real Flutterwave plan lookups are cached briefly so a paywall view doesn't
// hit the provider on every render. (Stripe presentment amounts now come from
// BillingConfig, not a live Price lookup.)
const PRICE_CACHE_TTL_MS = 5 * 60 * 1000;

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly stripe: StripeService,
    private readonly flutterwave: FlutterwaveService,
    private readonly entitlements: EntitlementService,
    private readonly config: BillingConfigService,
    private readonly fx: FxRateService,
  ) {}

  // --------------------------------------------------------------------------
  // Read models
  // --------------------------------------------------------------------------

  async getSubscriptionView(userId: string): Promise<SubscriptionView> {
    // Delegates to EntitlementService so the payment-failure grace window is
    // applied consistently with every other entitlement check.
    return this.entitlements.getSubscriptionView(userId);
  }

  /** The user's stored country of residence (set at registration), or null. */
  async getStoredCountry(userId: string): Promise<string | null> {
    const profile = await this.prisma.userProfile.findUnique({
      where: { userId },
      select: { countryCode: true },
    });
    return profile?.countryCode ?? null;
  }

  /**
   * Which provider a checkout for this user should use when the client hasn't
   * said: Flutterwave when the stored country of residence is a Flutterwave
   * country and it's configured, else Stripe.
   */
  private async providerForUser(userId: string): Promise<PaymentProvider> {
    const country = await this.getStoredCountry(userId);
    if (country && isFlutterwaveCountry(country) && this.flutterwave.isConfigured) {
      return 'flutterwave';
    }
    return 'stripe';
  }

  /**
   * Pre-checkout pricing. All amounts come from the admin-managed BillingConfig:
   *  - `base` = the configured base price ($4.99 USD by default).
   *  - Nigeria (and other Flutterwave countries) → `provider: 'flutterwave'`,
   *    `local` = the configured NG Naira amount.
   *  - Everyone else → `provider: 'stripe'`, `local` = the configured
   *    `currencyOptions` amount for the resolved currency, or null (→ USD only).
   *
   * No exchange-rate maths anywhere — every number is one a person set.
   */
  async getPricing(country?: string | null): Promise<PricingView> {
    const cfg = await this.config.getResolved();
    const base = { amountCents: cfg.basePriceCents, currency: cfg.baseCurrency };
    const resolvedCountry = country?.trim().toUpperCase() || null;

    if (isFlutterwaveCountry(resolvedCountry) && this.flutterwave.isConfigured) {
      try {
        const plan = await this.getFlwPlan();
        return {
          base,
          local: { amountCents: FlutterwaveService.nairaToMinor(plan.amount), currency: 'ngn' },
          localCountry: resolvedCountry,
          provider: 'flutterwave',
          estimate: true,
        };
      } catch (err) {
        this.logger.warn(`Flutterwave plan lookup failed, falling back to Stripe/USD: ${String(err)}`);
        // fall through to the Stripe path (card in USD)
      }
    }

    const currency = currencyForCountry(resolvedCountry);
    if (!currency || currency === cfg.baseCurrency) {
      return { base, local: null, localCountry: resolvedCountry, provider: 'stripe', estimate: true };
    }

    // Pre-checkout "estimated local equivalent" = the base price converted at
    // the daily FX rate (display-only, always labelled an estimate). An
    // admin-set Stripe `currency_options` amount is what Stripe actually
    // charges — used here only as a fallback when the FX feed has no rate for
    // this currency. The provider's checkout stays authoritative for the charge.
    const fx = await this.fx.getSnapshot();
    const fxMinor = FxRateService.estimate(fx, base.amountCents, base.currency, currency);
    const localMinor = fxMinor ?? cfg.currencyOptions[currency] ?? null;

    return {
      base,
      local: localMinor ? { amountCents: localMinor, currency } : null,
      localCountry: resolvedCountry,
      provider: 'stripe',
      estimate: true,
      ratesUpdatedAt: fx.fetchedAt ? fx.fetchedAt.toISOString() : null,
    };
  }

  private flwPlanCache: { at: number; plan: { id: number; amount: number; interval: string } } | null = null;

  private async getFlwPlan(): Promise<{ id: number; amount: number; interval: string }> {
    // Demo mode: the amount is the admin-managed NG price — always live, no cache.
    if (this.flutterwave.isDemo) {
      const cfg = await this.config.getResolved();
      return { id: 0, amount: cfg.flwNgnAmount, interval: 'monthly' };
    }
    if (this.flwPlanCache && Date.now() - this.flwPlanCache.at < PRICE_CACHE_TTL_MS) {
      return this.flwPlanCache.plan;
    }
    const plan = await this.flutterwave.getPaymentPlan();
    const shaped = { id: plan.id, amount: plan.amount, interval: plan.interval };
    this.flwPlanCache = { at: Date.now(), plan: shaped };
    return shaped;
  }

  // --------------------------------------------------------------------------
  // Checkout / portal
  // --------------------------------------------------------------------------

  async createCheckout(
    user: { userId: string; email: string; displayName?: string | null },
    provider?: PaymentProvider,
  ): Promise<CreateCheckoutResponse> {
    const existing = await this.prisma.subscription.findUnique({ where: { userId: user.userId } });
    // Grace-less on purpose: a `past_due` user still inside the dunning window
    // must be able to start a fresh checkout to fix their failed payment.
    if (existing && this.entitlements.computeEntitlement(existing).premium) {
      throw new ConflictException({
        message: 'You are already on FoodPadi Premium.',
        code: 'already_premium',
      });
    }

    const cfg = await this.config.getResolved();
    // Client passes the provider it showed the user; fall back to the one the
    // stored country of residence implies.
    const resolvedProvider = provider ?? (await this.providerForUser(user.userId));

    if (resolvedProvider === 'flutterwave') {
      return this.createFlutterwaveCheckout(user, cfg);
    }

    const customerId = await this.stripe.getOrCreateCustomer({
      userId: user.userId,
      email: user.email,
      existingCustomerId: existing?.stripeCustomerId,
    });

    // Persist the customer + the price this user is signing up at immediately,
    // so a second attempt (or a webhook that races ahead) reuses them.
    const priceSnapshot = { basePriceCents: cfg.basePriceCents, baseCurrency: cfg.baseCurrency };
    await this.prisma.subscription.upsert({
      where: { userId: user.userId },
      create: { userId: user.userId, provider: 'stripe', stripeCustomerId: customerId, ...priceSnapshot },
      update: { provider: 'stripe', stripeCustomerId: customerId, ...priceSnapshot },
    });

    const webUrl = this.stripe.webAppUrl;
    const session = await this.stripe.createCheckoutSession({
      customerId,
      userId: user.userId,
      priceId: cfg.stripePriceId ?? undefined,
      trialDays: cfg.trialDays,
      successUrl: `${webUrl}/premium/success?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${webUrl}/premium?checkout=cancelled`,
      // Display-only, for the local demo checkout page — ignored when live.
      amountCents: cfg.basePriceCents,
      currency: cfg.baseCurrency,
    });

    if (!session.url) {
      throw new BadRequestException('Stripe did not return a checkout URL.');
    }
    return { url: session.url, provider: 'stripe' };
  }

  private async createFlutterwaveCheckout(
    user: { userId: string; email: string; displayName?: string | null },
    cfg: import('./billing-config.service').ResolvedBillingConfig,
  ): Promise<CreateCheckoutResponse> {
    const plan = await this.getFlwPlan();
    // Fresh reference per attempt; stored so the redirect/webhook can be
    // matched back to this user. flw_tx_ref is unique in the DB.
    const txRef = `FP-${user.userId.slice(0, 8)}-${randomUUID()}`;
    const priceSnapshot = { basePriceCents: cfg.basePriceCents, baseCurrency: cfg.baseCurrency };

    await this.prisma.subscription.upsert({
      where: { userId: user.userId },
      create: {
        userId: user.userId,
        provider: 'flutterwave',
        status: 'incomplete',
        flwPlanId: cfg.flwPlanId ?? String(plan.id),
        flwTxRef: txRef,
        flwCustomerEmail: user.email,
        ...priceSnapshot,
      },
      update: {
        provider: 'flutterwave',
        flwPlanId: cfg.flwPlanId ?? String(plan.id),
        flwTxRef: txRef,
        flwCustomerEmail: user.email,
        ...priceSnapshot,
      },
    });

    const url = await this.flutterwave.createPaymentLink({
      userId: user.userId,
      email: user.email,
      name: user.displayName ?? undefined,
      txRef,
      amountNaira: cfg.flwNgnAmount,
      planId: cfg.flwPlanId,
      successUrl: `${this.flutterwave.webAppUrl}/premium/success?provider=flutterwave`,
    });
    return { url, provider: 'flutterwave' };
  }

  async createPortal(userId: string): Promise<{ url: string }> {
    const row = await this.prisma.subscription.findUnique({ where: { userId } });
    if (!row?.stripeCustomerId || row.provider !== 'stripe') {
      throw new NotFoundException({
        message: 'No billing account to manage yet.',
        code: 'no_customer',
      });
    }
    const session = await this.stripe.createPortalSession({
      customerId: row.stripeCustomerId,
      returnUrl: `${this.stripe.webAppUrl}/premium`,
    });
    return { url: session.url };
  }

  /**
   * In-app cancellation for Flutterwave subscriptions (Flutterwave has no
   * hosted portal). Stops future charges but keeps Premium until the current
   * paid period ends — matched by EntitlementService's cancel-at-period-end
   * rule. Stripe cancellations still go through the Stripe portal.
   */
  async cancelFlutterwaveSubscription(userId: string): Promise<SubscriptionView> {
    const row = await this.prisma.subscription.findUnique({ where: { userId } });
    if (!row || row.provider !== 'flutterwave' || !row.flwSubscriptionId) {
      throw new NotFoundException({
        message: 'No Flutterwave subscription to cancel.',
        code: 'no_subscription',
      });
    }
    if (!row.cancelAtPeriodEnd) {
      await this.flutterwave.cancelSubscription(row.flwSubscriptionId);
      await this.prisma.subscription.update({
        where: { userId },
        data: { cancelAtPeriodEnd: true, canceledAt: new Date() },
      });
    }
    return this.getSubscriptionView(userId);
  }

  /**
   * In-app cancellation for a demo Stripe subscription (a real Stripe
   * subscription still only cancels through the hosted portal — this is the
   * `STRIPE_DEMO_MODE` local stand-in for that, mirroring
   * `cancelFlutterwaveSubscription`). Premium stays active until the current
   * paid period ends, same as every other cancellation path.
   */
  async cancelStripeDemoSubscription(userId: string): Promise<SubscriptionView> {
    const row = await this.prisma.subscription.findUnique({ where: { userId } });
    if (!row || row.provider !== 'stripe' || !this.stripe.isDemo) {
      throw new NotFoundException({
        message: 'No demo Stripe subscription to cancel.',
        code: 'no_subscription',
      });
    }
    if (!row.cancelAtPeriodEnd) {
      await this.prisma.subscription.update({
        where: { userId },
        data: { cancelAtPeriodEnd: true, canceledAt: new Date() },
      });
    }
    return this.getSubscriptionView(userId);
  }

  /**
   * `/billing/cancel` dispatcher: routes to whichever in-app cancel path
   * applies — Flutterwave (no hosted portal at all) or a demo Stripe
   * subscription (no real portal to send them to). A real Stripe subscriber
   * still gets `cancelFlutterwaveSubscription`'s "no subscription to cancel"
   * 404 here, same as before this existed — they cancel via the portal.
   */
  async cancelSubscription(userId: string): Promise<SubscriptionView> {
    const row = await this.prisma.subscription.findUnique({ where: { userId } });
    if (row?.provider === 'stripe' && this.stripe.isDemo) {
      return this.cancelStripeDemoSubscription(userId);
    }
    return this.cancelFlutterwaveSubscription(userId);
  }

  /**
   * Called from the post-Checkout success page so Premium unlocks immediately,
   * without waiting for the webhook (task STEP 5: no refresh, no re-login).
   * Fully idempotent with the webhook path.
   */
  async syncCheckoutSession(
    user: { userId: string; email: string },
    params: CheckoutSyncRequest,
  ): Promise<CheckoutSyncResponse> {
    const before = await this.prisma.subscription.findUnique({ where: { userId: user.userId } });
    const wasPremium = this.entitlements.computeEntitlement(before).premium;

    if (params.provider === 'flutterwave') {
      return this.syncFlutterwaveCheckout(user, params, wasPremium);
    }

    if (!params.sessionId) {
      throw new BadRequestException('sessionId is required for a Stripe checkout sync.');
    }
    const session = await this.stripe.retrieveCheckoutSession(params.sessionId);

    // Ownership check — never let a user sync a session that is not theirs.
    const sessionUserId = session.client_reference_id ?? session.metadata?.foodpadiUserId;
    if (sessionUserId && sessionUserId !== user.userId) {
      throw new BadRequestException('This checkout session does not belong to you.');
    }

    const stripeSub = session.subscription;
    if (!stripeSub || typeof stripeSub === 'string') {
      // Payment not completed (or subscription not attached yet).
      const view = await this.getSubscriptionView(user.userId);
      return { subscription: view, justActivated: false };
    }

    const customerId =
      typeof session.customer === 'string' ? session.customer : session.customer?.id ?? null;

    await this.applySubscription(user.userId, stripeSub, customerId);

    const view = await this.getSubscriptionView(user.userId);
    return { subscription: view, justActivated: view.premium && !wasPremium };
  }

  private async syncFlutterwaveCheckout(
    user: { userId: string; email: string },
    params: CheckoutSyncRequest,
    wasPremium: boolean,
  ): Promise<CheckoutSyncResponse> {
    if (!params.transactionId || !params.txRef) {
      const view = await this.getSubscriptionView(user.userId);
      return { subscription: view, justActivated: false };
    }

    // Ownership: the tx_ref on the redirect must be the one we stored for this
    // user when they started checkout.
    const row = await this.prisma.subscription.findUnique({ where: { userId: user.userId } });
    if (!row || row.flwTxRef !== params.txRef) {
      throw new BadRequestException('This payment does not belong to you.');
    }

    // Never trust the redirect params — re-verify the transaction with
    // Flutterwave directly.
    const txn = await this.flutterwave.verifyTransaction(params.transactionId);
    const ok = await this.applyVerifiedFlutterwaveCharge(user.userId, txn, params.txRef);
    const view = await this.getSubscriptionView(user.userId);
    return { subscription: view, justActivated: ok && view.premium && !wasPremium };
  }

  /**
   * Shared writer for a verified successful Flutterwave charge — used by the
   * post-redirect sync AND the webhook. Idempotent: a repeat call for the same
   * transaction converges on the same row. Returns whether Premium is (now) on.
   */
  private async applyVerifiedFlutterwaveCharge(
    userId: string,
    txn: Awaited<ReturnType<FlutterwaveService['verifyTransaction']>>,
    expectedTxRef?: string,
  ): Promise<boolean> {
    const cfg = await this.config.getResolved();
    const plan = await this.getFlwPlan();

    const successful = txn.status === 'successful';
    const rightCurrency = (txn.currency ?? '').toUpperCase() === 'NGN';
    const rightAmount = Number(txn.amount) >= plan.amount; // allow >= (fees/rounding)
    const rightRef = !expectedTxRef || txn.tx_ref === expectedTxRef;

    if (!successful || !rightCurrency || !rightAmount || !rightRef) {
      this.logger.warn(
        `Flutterwave txn ${txn.id} not applied (status=${txn.status} currency=${txn.currency} amount=${txn.amount} refOk=${rightRef}).`,
      );
      return false;
    }

    const flwSub = await this.flutterwave
      .findActiveSubscription(txn.customer?.email ?? '', cfg.flwPlanId)
      .catch(() => null);

    // Flutterwave gives no explicit period end — derive it from the plan
    // interval, extending from the later of "now" and the current period end
    // (so a renewal charge stacks rather than resets).
    const base = await this.prisma.subscription.findUnique({ where: { userId } });
    const from =
      base?.currentPeriodEnd && base.currentPeriodEnd.getTime() > Date.now()
        ? base.currentPeriodEnd
        : new Date();
    const currentPeriodEnd = addInterval(from, plan.interval);

    await this.prisma.subscription.upsert({
      where: { userId },
      create: {
        userId,
        provider: 'flutterwave',
        status: 'active',
        basePriceCents: cfg.basePriceCents,
        baseCurrency: cfg.baseCurrency,
        flwPlanId: cfg.flwPlanId ?? String(plan.id),
        flwSubscriptionId: flwSub ? String(flwSub.id) : null,
        flwTxRef: txn.tx_ref,
        flwCustomerEmail: txn.customer?.email ?? null,
        presentmentAmountCents: FlutterwaveService.nairaToMinor(Number(txn.amount)),
        presentmentCurrency: 'ngn',
        customerCountry: 'NG',
        currentPeriodEnd,
        cancelAtPeriodEnd: false,
        canceledAt: null,
      },
      update: {
        provider: 'flutterwave',
        status: 'active',
        flwPlanId: cfg.flwPlanId ?? String(plan.id),
        ...(flwSub ? { flwSubscriptionId: String(flwSub.id) } : {}),
        flwCustomerEmail: txn.customer?.email ?? undefined,
        presentmentAmountCents: FlutterwaveService.nairaToMinor(Number(txn.amount)),
        presentmentCurrency: 'ngn',
        customerCountry: 'NG',
        currentPeriodEnd,
        cancelAtPeriodEnd: false,
        canceledAt: null,
      },
    });
    return true;
  }

  // --------------------------------------------------------------------------
  // Webhook
  // --------------------------------------------------------------------------

  /**
   * Idempotent webhook processor shared by both providers. The (namespaced)
   * event id is recorded in `webhook_events` first; a duplicate delivery hits
   * the primary-key conflict and is acked without reprocessing. If the handler
   * throws, the ledger row is removed so the provider's automatic retry can
   * have another go. Returns false when the event was a duplicate.
   */
  private async runOnce(
    provider: PaymentProvider,
    eventId: string,
    type: string,
    handler: () => Promise<void>,
  ): Promise<boolean> {
    const id = `${provider}:${eventId}`;
    try {
      await this.prisma.webhookEvent.create({ data: { id, provider, type } });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        this.logger.log(`${provider} event ${eventId} (${type}) already processed — skipping.`);
        return false;
      }
      throw err;
    }
    try {
      await handler();
    } catch (err) {
      await this.prisma.webhookEvent.delete({ where: { id } }).catch(() => undefined);
      throw err;
    }
    return true;
  }

  async handleWebhookEvent(event: Stripe.Event): Promise<void> {
    await this.runOnce('stripe', event.id, event.type, () => this.dispatch(event));
  }

  /**
   * Flutterwave webhook. Auth (verif-hash) is checked in the controller. The
   * payload is not trusted for money decisions — `charge.completed` triggers a
   * fresh `verifyTransaction` before anything is written.
   */
  async handleFlutterwaveWebhook(payload: {
    event?: string;
    data?: Record<string, any>;
  }): Promise<void> {
    const event = payload.event ?? 'unknown';
    const data = payload.data ?? {};
    const eventId = String(data.id ?? data.tx_ref ?? `${event}:${Date.now()}`);

    await this.runOnce('flutterwave', eventId, event, async () => {
      if (event === 'charge.completed') {
        if (data.status !== 'successful') return;
        const userId = await this.resolveUserIdFromFlwData(data);
        if (!userId) {
          this.logger.warn(`Flutterwave charge.completed ${eventId} could not be mapped to a user.`);
          return;
        }
        const txn = await this.flutterwave.verifyTransaction(data.id);
        await this.applyVerifiedFlutterwaveCharge(userId, txn);
        return;
      }

      if (event === 'subscription.cancelled' || event === 'subscription.deactivated') {
        const userId = await this.resolveUserIdFromFlwData(data);
        if (!userId) return;
        await this.prisma.subscription.update({
          where: { userId },
          data: { cancelAtPeriodEnd: true, canceledAt: new Date() },
        });
        return;
      }

      this.logger.debug(`Unhandled Flutterwave event: ${event}`);
    });
  }

  private async resolveUserIdFromFlwData(data: Record<string, any>): Promise<string | null> {
    const fromMeta = data.meta?.foodpadiUserId ?? data.meta?.foodpadi_user_id;
    if (fromMeta) return String(fromMeta);

    const txRef: string | undefined = data.tx_ref;
    if (txRef) {
      const byRef = await this.prisma.subscription.findUnique({ where: { flwTxRef: txRef } });
      if (byRef) return byRef.userId;
    }
    const subId = data.subscription_id ?? data.plan_subscription_id ?? data.id;
    if (subId) {
      const bySub = await this.prisma.subscription
        .findUnique({ where: { flwSubscriptionId: String(subId) } })
        .catch(() => null);
      if (bySub) return bySub.userId;
    }
    const email: string | undefined = data.customer?.email ?? data.customer_email;
    if (email) {
      const byEmail = await this.prisma.subscription.findFirst({
        where: { flwCustomerEmail: email, provider: 'flutterwave' },
      });
      if (byEmail) return byEmail.userId;
    }
    return null;
  }

  private async dispatch(event: Stripe.Event): Promise<void> {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.client_reference_id ?? session.metadata?.foodpadiUserId ?? null;
        if (!userId) {
          this.logger.warn(`checkout.session.completed ${session.id} has no foodpadi user id.`);
          return;
        }
        const customerId =
          typeof session.customer === 'string' ? session.customer : session.customer?.id ?? null;
        const subId =
          typeof session.subscription === 'string'
            ? session.subscription
            : session.subscription?.id ?? null;
        if (!subId) {
          if (customerId) {
            await this.prisma.subscription.upsert({
              where: { userId },
              create: { userId, stripeCustomerId: customerId },
              update: { stripeCustomerId: customerId },
            });
          }
          return;
        }
        const stripeSub = await this.stripe.retrieveSubscription(subId);
        await this.applySubscription(userId, stripeSub, customerId);
        return;
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        const userId = await this.resolveUserIdFromSubscription(sub);
        if (!userId) {
          this.logger.warn(`${event.type} ${sub.id} could not be mapped to a user.`);
          return;
        }
        await this.applySubscription(userId, sub, null);
        return;
      }

      case 'invoice.paid':
      case 'invoice.payment_succeeded':
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        await this.applyInvoice(invoice);
        return;
      }

      default:
        this.logger.debug(`Unhandled Stripe event type: ${event.type}`);
    }
  }

  // --------------------------------------------------------------------------
  // Shared writers
  // --------------------------------------------------------------------------

  private async applySubscription(
    userId: string,
    sub: Stripe.Subscription,
    customerId: string | null,
  ): Promise<Subscription> {
    const resolvedCustomerId =
      customerId ?? (typeof sub.customer === 'string' ? sub.customer : sub.customer?.id ?? null);

    const priceId = sub.items?.data?.[0]?.price?.id ?? null;
    const data = {
      stripeSubscriptionId: sub.id,
      ...(resolvedCustomerId ? { stripeCustomerId: resolvedCustomerId } : {}),
      ...(priceId ? { stripePriceId: priceId } : {}),
      status: sub.status,
      currentPeriodEnd: toDate(sub.current_period_end),
      cancelAtPeriodEnd: sub.cancel_at_period_end ?? false,
      canceledAt: toDate(sub.canceled_at),
      trialEndsAt: toDate(sub.trial_end),
    };

    // Only stamp the base price when first creating the row (webhook arrived
    // before the checkout row existed) — never overwrite a subscriber's
    // historical price on a later webhook.
    const cfg = await this.config.getResolved();
    return this.prisma.subscription.upsert({
      where: { userId },
      create: {
        userId,
        provider: 'stripe',
        basePriceCents: cfg.basePriceCents,
        baseCurrency: cfg.baseCurrency,
        ...data,
      },
      update: data,
    });
  }

  private async applyInvoice(invoice: Stripe.Invoice): Promise<void> {
    const subId = invoiceSubscriptionId(invoice);
    const customerId =
      typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id ?? null;

    let userId: string | null = null;
    if (subId) {
      const bySub = await this.prisma.subscription.findUnique({
        where: { stripeSubscriptionId: subId },
      });
      userId = bySub?.userId ?? null;
    }
    if (!userId && customerId) {
      const byCustomer = await this.prisma.subscription.findUnique({
        where: { stripeCustomerId: customerId },
      });
      userId = byCustomer?.userId ?? null;
    }
    if (!userId && subId) {
      // Row not linked yet — resolve via the subscription's metadata.
      const stripeSub = await this.stripe.retrieveSubscription(subId).catch(() => null);
      if (stripeSub) {
        userId = await this.resolveUserIdFromSubscription(stripeSub);
        if (userId) await this.applySubscription(userId, stripeSub, customerId);
      }
    }
    if (!userId) {
      this.logger.warn(`Invoice ${invoice.id} could not be mapped to a user.`);
      return;
    }

    // The actual amount + currency Stripe charged this customer — copied
    // verbatim, never used to overwrite the canonical base price.
    const presentmentAmount = invoice.amount_paid ?? invoice.amount_due ?? null;
    const country =
      invoice.customer_address?.country ??
      (invoice as unknown as { account_country?: string }).account_country ??
      null;

    await this.prisma.subscription.update({
      where: { userId },
      data: {
        ...(presentmentAmount != null ? { presentmentAmountCents: presentmentAmount } : {}),
        ...(invoice.currency ? { presentmentCurrency: invoice.currency } : {}),
        ...(country ? { customerCountry: country } : {}),
      },
    });

    // Keep status fresh on payment failure without a second round-trip when we
    // can avoid it: subscription.updated normally follows, but syncing here
    // closes any ordering gap.
    if (subId) {
      const stripeSub = await this.stripe.retrieveSubscription(subId).catch(() => null);
      if (stripeSub) await this.applySubscription(userId, stripeSub, customerId);
    }
  }

  private async resolveUserIdFromSubscription(sub: Stripe.Subscription): Promise<string | null> {
    const fromMetadata = sub.metadata?.foodpadiUserId;
    if (fromMetadata) return fromMetadata;

    const bySub = await this.prisma.subscription.findUnique({
      where: { stripeSubscriptionId: sub.id },
    });
    if (bySub) return bySub.userId;

    const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer?.id;
    if (customerId) {
      const byCustomer = await this.prisma.subscription.findUnique({
        where: { stripeCustomerId: customerId },
      });
      if (byCustomer) return byCustomer.userId;
    }
    return null;
  }
}

function toDate(unixSeconds: number | null | undefined): Date | null {
  return unixSeconds ? new Date(unixSeconds * 1000) : null;
}

// Flutterwave gives no period-end timestamp — derive it from the plan interval.
function addInterval(from: Date, interval: string): Date {
  const d = new Date(from);
  switch ((interval ?? 'monthly').toLowerCase()) {
    case 'yearly':
    case 'annually':
      d.setFullYear(d.getFullYear() + 1);
      break;
    case 'weekly':
      d.setDate(d.getDate() + 7);
      break;
    case 'quarterly':
      d.setMonth(d.getMonth() + 3);
      break;
    default: // monthly
      d.setMonth(d.getMonth() + 1);
  }
  return d;
}

function invoiceSubscriptionId(invoice: Stripe.Invoice): string | null {
  const direct = (invoice as unknown as { subscription?: string | { id: string } | null })
    .subscription;
  if (direct) return typeof direct === 'string' ? direct : direct.id;
  // Newer API shape: invoice.parent.subscription_details.subscription
  const nested = (
    invoice as unknown as {
      parent?: { subscription_details?: { subscription?: string | { id: string } } };
    }
  ).parent?.subscription_details?.subscription;
  if (nested) return typeof nested === 'string' ? nested : nested.id;
  return null;
}
