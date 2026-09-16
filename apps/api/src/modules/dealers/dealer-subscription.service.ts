import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Prisma, type DealerSubscription } from '@prisma/client';
import type Stripe from 'stripe';
import type {
  DealerCheckoutResponse,
  DealerCheckoutSyncRequest,
  DealerCheckoutSyncResponse,
  DealerSubscriptionView,
  PaymentProvider,
} from '@foodpadi/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { StripeService } from '../billing/stripe.service';
import { FlutterwaveService } from '../billing/flutterwave.service';
import { BillingConfigService } from '../billing/billing-config.service';
import { isFlutterwaveCountry } from '../billing/country-currency';
import { DealerEntitlementService } from './dealer-entitlement.service';
import { DealerSearchProfileService } from './dealer-search-profile.service';

// Flat pricing — no FX-estimate engine, no per-currency options (dealer brief
// §44/§45: keep pricing simple). The canonical price is admin-managed from the
// same billing dashboard as Premium (billing_config.dealerPriceCents, default
// $4.99/mo); DEALER_SUB_PRICE_CENTS / DEALER_SUB_NGN_AMOUNT are only a
// last-resort fallback for a misconfigured DB.
function envPriceCents(): number {
  const n = Number.parseInt(process.env.DEALER_SUB_PRICE_CENTS ?? '', 10);
  return Number.isFinite(n) && n > 0 ? n : 499;
}
function envNgnAmount(): number {
  const n = Number.parseInt(process.env.DEALER_SUB_NGN_AMOUNT ?? '', 10);
  return Number.isFinite(n) && n > 0 ? n : 7_500;
}

// Namespaced so a dealer webhook event id can never collide with a Premium one
// in the shared `webhook_events` ledger.
const LEDGER_STRIPE = 'dealer-stripe';
const LEDGER_FLW = 'dealer-flutterwave';

export interface DealerActor {
  dealerId: string;
  ownerUserId: string;
  email: string;
  name?: string | null;
}

/**
 * The dealer B2B subscription — a SEPARATE product from FoodPadi Premium that
 * never touches the `subscriptions` row (dealer brief §13). Mirrors
 * billing/BillingService's checkout / portal / cancel / sync / webhook shape
 * but writes `dealer_subscriptions` and reuses StripeService / FlutterwaveService
 * as-is (their dealer-specific methods carry a dealerId instead of a userId).
 *
 * Every state change that could affect whether a dealer is paid-up ends with a
 * DealerSearchProfileService.rebuild() so the search index's `subscriptionActive`
 * flag — and the brief §25 expired/active listing transition — stay in step.
 */
@Injectable()
export class DealerSubscriptionService {
  private readonly logger = new Logger(DealerSubscriptionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly stripe: StripeService,
    private readonly flutterwave: FlutterwaveService,
    private readonly entitlement: DealerEntitlementService,
    private readonly searchProfile: DealerSearchProfileService,
    private readonly config: BillingConfigService,
  ) {}

  /** Admin-managed dealer price (billing_config), with an env fallback. */
  private async price(): Promise<{ cents: number; currency: string; ngn: number; stripePriceId: string | null }> {
    try {
      const c = await this.config.getResolved();
      return {
        cents: c.dealerPriceCents || envPriceCents(),
        currency: c.baseCurrency || 'usd',
        ngn: c.dealerNgnAmount || envNgnAmount(),
        stripePriceId: c.dealerStripePriceId,
      };
    } catch {
      return { cents: envPriceCents(), currency: 'usd', ngn: envNgnAmount(), stripePriceId: null };
    }
  }

  // --------------------------------------------------------------------------
  // Read model
  // --------------------------------------------------------------------------

  async getView(dealerId: string): Promise<DealerSubscriptionView> {
    const [row, ent, price] = await Promise.all([
      this.prisma.dealerSubscription.findUnique({ where: { dealerId } }),
      this.entitlement.getEntitlement(dealerId),
      this.price(),
    ]);
    return this.toView(row, ent.active, price);
  }

  private toView(
    row: DealerSubscription | null,
    active: boolean,
    fallback: { cents: number; currency: string },
  ): DealerSubscriptionView {
    const provider = (row?.provider as PaymentProvider) ?? 'stripe';
    return {
      status: (row?.status as DealerSubscriptionView['status']) ?? 'none',
      active,
      provider,
      plan: row?.plan ?? 'dealer_monthly',
      // A subscribed dealer keeps the price snapshot on its row; a not-yet-
      // subscribed one shows the current admin-managed dealer price.
      price: {
        amountCents: row?.basePriceCents ?? fallback.cents,
        currency: row?.baseCurrency ?? fallback.currency,
      },
      presentment:
        row?.presentmentAmountCents != null && row.presentmentCurrency
          ? { amountCents: row.presentmentAmountCents, currency: row.presentmentCurrency }
          : null,
      billingInterval: row?.billingInterval ?? 'month',
      currentPeriodEnd: row?.currentPeriodEnd?.toISOString() ?? null,
      cancelAtPeriodEnd: row?.cancelAtPeriodEnd ?? false,
      canceledAt: row?.canceledAt?.toISOString() ?? null,
      trialEndsAt: row?.trialEndsAt?.toISOString() ?? null,
      canManage: provider === 'stripe' && Boolean(row?.stripeCustomerId) && !this.stripe.isDemo,
      canCancel:
        (provider === 'flutterwave' || (provider === 'stripe' && this.stripe.isDemo)) &&
        active &&
        !(row?.cancelAtPeriodEnd ?? false),
    };
  }

  // --------------------------------------------------------------------------
  // Checkout / portal / cancel
  // --------------------------------------------------------------------------

  private async providerForDealer(ownerUserId: string): Promise<PaymentProvider> {
    const profile = await this.prisma.userProfile.findUnique({
      where: { userId: ownerUserId },
      select: { countryCode: true },
    });
    if (
      profile?.countryCode &&
      isFlutterwaveCountry(profile.countryCode) &&
      this.flutterwave.isDealerConfigured
    ) {
      return 'flutterwave';
    }
    return 'stripe';
  }

  async createCheckout(
    actor: DealerActor,
    provider?: PaymentProvider,
  ): Promise<DealerCheckoutResponse> {
    const existing = await this.prisma.dealerSubscription.findUnique({
      where: { dealerId: actor.dealerId },
    });
    // Grace-less on purpose (same as Premium): a past_due dealer inside the
    // dunning window must be able to start a fresh checkout to fix payment.
    if (existing && this.entitlement.computeEntitlement(existing).active) {
      throw new ConflictException({
        message: 'This business already has an active FoodPadi Food Dealer subscription.',
        code: 'already_active',
      });
    }

    const resolvedProvider = provider ?? (await this.providerForDealer(actor.ownerUserId));
    const px = await this.price();
    const priceSnapshot = { basePriceCents: px.cents, baseCurrency: px.currency };

    if (resolvedProvider === 'flutterwave') {
      const txRef = `FPD-${actor.dealerId.slice(0, 8)}-${randomUUID()}`;
      await this.prisma.dealerSubscription.upsert({
        where: { dealerId: actor.dealerId },
        create: {
          dealerId: actor.dealerId,
          provider: 'flutterwave',
          status: 'incomplete',
          flwPlanId: process.env.FLW_DEALER_PLAN_ID ?? null,
          flwTxRef: txRef,
          flwCustomerEmail: actor.email,
          ...priceSnapshot,
        },
        update: {
          provider: 'flutterwave',
          flwPlanId: process.env.FLW_DEALER_PLAN_ID ?? null,
          flwTxRef: txRef,
          flwCustomerEmail: actor.email,
          ...priceSnapshot,
        },
      });
      const url = await this.flutterwave.createDealerPaymentLink({
        dealerId: actor.dealerId,
        email: actor.email,
        name: actor.name ?? undefined,
        txRef,
        amountNaira: px.ngn,
        successUrl: `${this.flutterwave.webAppUrl}/dealers/dashboard?activated=1&provider=flutterwave`,
      });
      return { url, provider: 'flutterwave' };
    }

    const customerId = await this.stripe.getOrCreateCustomer({
      userId: actor.ownerUserId,
      email: actor.email,
      existingCustomerId: existing?.stripeCustomerId,
    });
    await this.prisma.dealerSubscription.upsert({
      where: { dealerId: actor.dealerId },
      create: {
        dealerId: actor.dealerId,
        provider: 'stripe',
        stripeCustomerId: customerId,
        ...priceSnapshot,
      },
      update: { provider: 'stripe', stripeCustomerId: customerId, ...priceSnapshot },
    });

    const webUrl = this.stripe.webAppUrl;
    const session = await this.stripe.createDealerCheckoutSession({
      customerId,
      dealerId: actor.dealerId,
      priceId: px.stripePriceId ?? undefined,
      successUrl: `${webUrl}/dealers/dashboard?activated=1&session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${webUrl}/dealers/onboarding?checkout=cancelled`,
      amountCents: px.cents,
      currency: px.currency,
    });
    return { url: session.url, provider: 'stripe' };
  }

  async createPortal(dealerId: string): Promise<{ url: string }> {
    const row = await this.prisma.dealerSubscription.findUnique({ where: { dealerId } });
    if (!row?.stripeCustomerId || row.provider !== 'stripe' || this.stripe.isDemo) {
      throw new NotFoundException({
        message: 'No billing account to manage yet.',
        code: 'no_customer',
      });
    }
    const session = await this.stripe.createPortalSession({
      customerId: row.stripeCustomerId,
      returnUrl: `${this.stripe.webAppUrl}/dealers/dashboard`,
    });
    return { url: session.url };
  }

  /**
   * In-app cancellation for Flutterwave / demo-Stripe dealer subscriptions
   * (a real Stripe sub cancels through the hosted portal instead). The listing
   * stays live until the paid period ends — DealerEntitlementService's
   * cancel-at-period-end rule — then DealerSearchProfileService.rebuild on the
   * next read/webhook flips it to `expired`.
   */
  async cancel(dealerId: string): Promise<DealerSubscriptionView> {
    const row = await this.prisma.dealerSubscription.findUnique({ where: { dealerId } });
    if (!row) {
      throw new NotFoundException({ message: 'No subscription to cancel.', code: 'no_subscription' });
    }
    const isFlw = row.provider === 'flutterwave';
    const isDemoStripe = row.provider === 'stripe' && this.stripe.isDemo;
    if (!isFlw && !isDemoStripe) {
      throw new NotFoundException({
        message: 'This subscription is managed through the billing portal.',
        code: 'use_portal',
      });
    }
    if (!row.cancelAtPeriodEnd) {
      if (isFlw && row.flwSubscriptionId) {
        await this.flutterwave.cancelSubscription(row.flwSubscriptionId);
      }
      await this.prisma.dealerSubscription.update({
        where: { dealerId },
        data: { cancelAtPeriodEnd: true, canceledAt: new Date() },
      });
    }
    await this.searchProfile.rebuild(dealerId);
    return this.getView(dealerId);
  }

  // --------------------------------------------------------------------------
  // Post-checkout sync (so the dashboard activates without waiting for a webhook)
  // --------------------------------------------------------------------------

  async syncCheckoutSession(
    actor: DealerActor,
    params: DealerCheckoutSyncRequest,
  ): Promise<DealerCheckoutSyncResponse> {
    const before = await this.prisma.dealerSubscription.findUnique({
      where: { dealerId: actor.dealerId },
    });
    const wasActive = this.entitlement.computeEntitlement(before).active;

    if (params.provider === 'flutterwave') {
      const done = await this.syncFlutterwave(actor, params);
      const subscription = await this.getView(actor.dealerId);
      return { subscription, justActivated: done && subscription.active && !wasActive };
    }

    if (!params.sessionId) {
      const subscription = await this.getView(actor.dealerId);
      return { subscription, justActivated: false };
    }
    const session = await this.stripe.retrieveDealerCheckoutSession(params.sessionId);
    const sessionDealerId =
      session.client_reference_id ?? (session.metadata?.foodpadiDealerId as string | undefined);
    if (sessionDealerId && sessionDealerId !== actor.dealerId) {
      throw new BadRequestException('This checkout session does not belong to your business.');
    }

    const stripeSub = session.subscription;
    if (!stripeSub || typeof stripeSub === 'string') {
      const subscription = await this.getView(actor.dealerId);
      return { subscription, justActivated: false };
    }
    const customerId =
      typeof session.customer === 'string' ? session.customer : session.customer?.id ?? null;
    await this.applyStripeSubscription(actor.dealerId, stripeSub, customerId);

    const subscription = await this.getView(actor.dealerId);
    return { subscription, justActivated: subscription.active && !wasActive };
  }

  private async syncFlutterwave(
    actor: DealerActor,
    params: DealerCheckoutSyncRequest,
  ): Promise<boolean> {
    if (!params.transactionId || !params.txRef) return false;
    const row = await this.prisma.dealerSubscription.findUnique({
      where: { dealerId: actor.dealerId },
    });
    if (!row || row.flwTxRef !== params.txRef) {
      throw new BadRequestException('This payment does not belong to your business.');
    }
    const txn = await this.flutterwave.verifyTransaction(params.transactionId);
    return this.applyVerifiedFlutterwaveCharge(actor.dealerId, txn, params.txRef);
  }

  // --------------------------------------------------------------------------
  // Webhooks
  // --------------------------------------------------------------------------

  private async runOnce(
    ledger: string,
    eventId: string,
    type: string,
    handler: () => Promise<void>,
  ): Promise<boolean> {
    const id = `${ledger}:${eventId}`;
    const provider = ledger === LEDGER_FLW ? 'flutterwave' : 'stripe';
    try {
      await this.prisma.webhookEvent.create({ data: { id, provider, type } });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        this.logger.log(`${ledger} event ${eventId} (${type}) already processed — skipping.`);
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

  async handleStripeWebhook(event: Stripe.Event): Promise<void> {
    await this.runOnce(LEDGER_STRIPE, event.id, event.type, async () => {
      switch (event.type) {
        case 'checkout.session.completed': {
          const session = event.data.object as Stripe.Checkout.Session;
          const dealerId =
            session.client_reference_id ??
            (session.metadata?.foodpadiDealerId as string | undefined) ??
            null;
          if (!dealerId) {
            this.logger.warn(`dealer checkout.session.completed ${session.id} has no dealer id.`);
            return;
          }
          const customerId =
            typeof session.customer === 'string' ? session.customer : session.customer?.id ?? null;
          const subId =
            typeof session.subscription === 'string'
              ? session.subscription
              : session.subscription?.id ?? null;
          if (!subId) return;
          const sub = await this.stripe.retrieveSubscription(subId);
          await this.applyStripeSubscription(dealerId, sub, customerId);
          return;
        }
        case 'customer.subscription.created':
        case 'customer.subscription.updated':
        case 'customer.subscription.deleted': {
          const sub = event.data.object as Stripe.Subscription;
          const dealerId = await this.resolveDealerIdFromStripeSub(sub);
          if (!dealerId) {
            this.logger.warn(`${event.type} ${sub.id} could not be mapped to a dealer.`);
            return;
          }
          await this.applyStripeSubscription(dealerId, sub, null);
          return;
        }
        default:
          this.logger.debug(`Unhandled dealer Stripe event type: ${event.type}`);
      }
    });
  }

  async handleFlutterwaveWebhook(payload: {
    event?: string;
    data?: Record<string, any>;
  }): Promise<void> {
    const event = payload.event ?? 'unknown';
    const data = payload.data ?? {};
    const eventId = String(data.id ?? data.tx_ref ?? `${event}:${Date.now()}`);

    await this.runOnce(LEDGER_FLW, eventId, event, async () => {
      if (event === 'charge.completed') {
        if (data.status !== 'successful') return;
        const dealerId = await this.resolveDealerIdFromFlwData(data);
        if (!dealerId) {
          this.logger.warn(`dealer Flutterwave charge.completed ${eventId} not mapped to a dealer.`);
          return;
        }
        const txn = await this.flutterwave.verifyTransaction(data.id);
        await this.applyVerifiedFlutterwaveCharge(dealerId, txn);
        return;
      }
      if (event === 'subscription.cancelled' || event === 'subscription.deactivated') {
        const dealerId = await this.resolveDealerIdFromFlwData(data);
        if (!dealerId) return;
        await this.prisma.dealerSubscription.update({
          where: { dealerId },
          data: { cancelAtPeriodEnd: true, canceledAt: new Date() },
        });
        await this.searchProfile.rebuild(dealerId);
        return;
      }
      this.logger.debug(`Unhandled dealer Flutterwave event: ${event}`);
    });
  }

  // --------------------------------------------------------------------------
  // Shared writers
  // --------------------------------------------------------------------------

  private async applyStripeSubscription(
    dealerId: string,
    sub: Stripe.Subscription,
    customerId: string | null,
  ): Promise<void> {
    const resolvedCustomerId =
      customerId ?? (typeof sub.customer === 'string' ? sub.customer : sub.customer?.id ?? null);
    const priceId = sub.items?.data?.[0]?.price?.id ?? null;
    const px = await this.price();

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

    await this.prisma.dealerSubscription.upsert({
      where: { dealerId },
      create: {
        dealerId,
        provider: 'stripe',
        plan: 'dealer_monthly',
        basePriceCents: px.cents,
        baseCurrency: px.currency,
        ...data,
      },
      update: data,
    });

    // Listing activation (activatedAt + listingStatus → 'active') is decided
    // entirely by DealerSearchProfileService.rebuild — it alone enforces that
    // a payment can only activate an already-admin-approved dealer.
    await this.searchProfile.rebuild(dealerId);
  }

  private async applyVerifiedFlutterwaveCharge(
    dealerId: string,
    txn: Awaited<ReturnType<FlutterwaveService['verifyTransaction']>>,
    expectedTxRef?: string,
  ): Promise<boolean> {
    const px = await this.price();
    const successful = txn.status === 'successful';
    const rightCurrency = (txn.currency ?? '').toUpperCase() === 'NGN';
    // Demo mode synthesises the charge from the Premium NGN amount, which can
    // differ from the admin-set dealer NGN amount — never a real-money check
    // there, so skip the amount gate. Live charges are still validated.
    const rightAmount = this.flutterwave.isDemo || Number(txn.amount) >= px.ngn;
    const rightRef = !expectedTxRef || txn.tx_ref === expectedTxRef;

    if (!successful || !rightCurrency || !rightAmount || !rightRef) {
      this.logger.warn(
        `dealer Flutterwave txn ${txn.id} not applied (status=${txn.status} currency=${txn.currency} amount=${txn.amount} refOk=${rightRef}).`,
      );
      return false;
    }

    const flwSub = await this.flutterwave
      .findActiveSubscription(txn.customer?.email ?? '', process.env.FLW_DEALER_PLAN_ID)
      .catch(() => null);

    const base = await this.prisma.dealerSubscription.findUnique({ where: { dealerId } });
    const from =
      base?.currentPeriodEnd && base.currentPeriodEnd.getTime() > Date.now()
        ? base.currentPeriodEnd
        : new Date();
    const currentPeriodEnd = new Date(from);
    currentPeriodEnd.setMonth(currentPeriodEnd.getMonth() + 1);

    const shared = {
      provider: 'flutterwave' as const,
      status: 'active',
      flwSubscriptionId: flwSub ? String(flwSub.id) : base?.flwSubscriptionId ?? null,
      flwCustomerEmail: txn.customer?.email ?? base?.flwCustomerEmail ?? null,
      presentmentAmountCents: FlutterwaveService.nairaToMinor(Number(txn.amount)),
      presentmentCurrency: 'ngn',
      customerCountry: 'NG',
      currentPeriodEnd,
      cancelAtPeriodEnd: false,
      canceledAt: null,
    };

    await this.prisma.dealerSubscription.upsert({
      where: { dealerId },
      create: {
        dealerId,
        plan: 'dealer_monthly',
        basePriceCents: px.cents,
        baseCurrency: px.currency,
        flwPlanId: process.env.FLW_DEALER_PLAN_ID ?? null,
        flwTxRef: txn.tx_ref,
        ...shared,
      },
      update: shared,
    });
    // Listing activation is decided entirely by rebuild() — see the comment in
    // applyStripeSubscription above.
    await this.searchProfile.rebuild(dealerId);
    return true;
  }

  private async resolveDealerIdFromStripeSub(sub: Stripe.Subscription): Promise<string | null> {
    const fromMeta = sub.metadata?.foodpadiDealerId;
    if (fromMeta) return fromMeta;
    const bySub = await this.prisma.dealerSubscription.findUnique({
      where: { stripeSubscriptionId: sub.id },
    });
    if (bySub) return bySub.dealerId;
    const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer?.id;
    if (customerId) {
      const byCustomer = await this.prisma.dealerSubscription.findUnique({
        where: { stripeCustomerId: customerId },
      });
      if (byCustomer) return byCustomer.dealerId;
    }
    return null;
  }

  private async resolveDealerIdFromFlwData(data: Record<string, any>): Promise<string | null> {
    const fromMeta = data.meta?.foodpadiDealerId ?? data.meta?.foodpadi_dealer_id;
    if (fromMeta) return String(fromMeta);
    const txRef: string | undefined = data.tx_ref;
    if (txRef) {
      const byRef = await this.prisma.dealerSubscription.findUnique({ where: { flwTxRef: txRef } });
      if (byRef) return byRef.dealerId;
    }
    const subId = data.subscription_id ?? data.plan_subscription_id ?? data.id;
    if (subId) {
      const bySub = await this.prisma.dealerSubscription
        .findUnique({ where: { flwSubscriptionId: String(subId) } })
        .catch(() => null);
      if (bySub) return bySub.dealerId;
    }
    const email: string | undefined = data.customer?.email ?? data.customer_email;
    if (email) {
      const byEmail = await this.prisma.dealerSubscription.findFirst({
        where: { flwCustomerEmail: email, provider: 'flutterwave' },
      });
      if (byEmail) return byEmail.dealerId;
    }
    return null;
  }
}

function toDate(unixSeconds: number | null | undefined): Date | null {
  return unixSeconds ? new Date(unixSeconds * 1000) : null;
}
