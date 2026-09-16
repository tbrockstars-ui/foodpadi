import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';

const FLW_BASE_URL = 'https://api.flutterwave.com/v3';
const DEMO_PLAN_ID = 'demo-plan';
const DEMO_TXN_PREFIX = 'DEMO-';
const DEFAULT_DEMO_NGN = 7500;

export interface FlwPaymentPlan {
  id: number;
  name: string;
  amount: number; // major units (Naira), Flutterwave's convention for NGN
  interval: string; // "monthly"
  currency: string; // "NGN"
  status: string;
}

export interface FlwTransaction {
  id: number;
  tx_ref: string;
  status: string; // "successful" | "failed" | "pending"
  amount: number; // major units
  currency: string;
  customer: { id: number; email: string; name?: string };
  payment_plan?: number | null;
  meta?: Record<string, unknown> | null;
}

export interface FlwSubscription {
  id: number;
  plan: number;
  customer: { id: number; customer_email: string };
  status: string; // "active" | "cancelled"
  created_at?: string;
}

/**
 * Flutterwave client for the Nigeria journey (native NGN, cards, bank transfer,
 * USSD). Fetch-based — Flutterwave has no maintained first-party Node SDK worth
 * a dependency. Lazily configured, exactly like StripeService: with no key the
 * API still boots and every `/billing/*` Flutterwave path returns 503.
 *
 * DEMO MODE (`FLW_DEMO_MODE=true`, same precedent as `SCAN_DEMO_MODE`): the
 * whole Nigeria journey works with no Flutterwave account and no real money.
 * `createPaymentLink` points at a local demo checkout page, and
 * `verifyTransaction` returns a synthetic successful charge. Nothing ever
 * leaves the server. Meant for MVP demos / UX validation only.
 */
@Injectable()
export class FlutterwaveService {
  private readonly logger = new Logger(FlutterwaveService.name);

  get isDemo(): boolean {
    return process.env.FLW_DEMO_MODE === 'true';
  }

  /**
   * Kept in sync by BillingConfigService so demo amounts follow the
   * admin-managed NG price. One-way (config → here), so no dependency cycle.
   */
  demoAmountNairaOverride: number | null = null;

  get isConfigured(): boolean {
    if (this.isDemo) return true;
    return Boolean(process.env.FLW_SECRET_KEY && process.env.FLW_PLAN_ID);
  }

  get planId(): string {
    if (this.isDemo) return process.env.FLW_PLAN_ID || DEMO_PLAN_ID;
    const id = process.env.FLW_PLAN_ID;
    if (!id) throw new ServiceUnavailableException('Nigeria payments are not configured on this server.');
    return id;
  }

  private get demoNgnAmount(): number {
    if (this.demoAmountNairaOverride && this.demoAmountNairaOverride > 0) {
      return this.demoAmountNairaOverride;
    }
    const n = Number.parseInt(process.env.FLW_NGN_AMOUNT ?? '', 10);
    return Number.isFinite(n) && n > 0 ? n : DEFAULT_DEMO_NGN;
  }

  get webAppUrl(): string {
    const raw = process.env.WEB_APP_URL ?? 'http://localhost:3100';
    return raw.split(',')[0].trim().replace(/\/$/, '');
  }

  /** Flutterwave reports NGN in whole Naira; our MoneyView uses minor units. */
  static nairaToMinor(naira: number): number {
    return Math.round(naira * 100);
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const key = process.env.FLW_SECRET_KEY;
    if (!key) {
      throw new ServiceUnavailableException('Nigeria payments are not configured on this server.');
    }
    const res = await fetch(`${FLW_BASE_URL}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        ...(init?.headers ?? {}),
      },
    });
    const body = (await res.json().catch(() => null)) as
      | { status?: string; message?: string; data?: unknown }
      | null;
    if (!res.ok || body?.status === 'error') {
      const message = body?.message ?? `Flutterwave request failed (${res.status}).`;
      this.logger.warn(`${init?.method ?? 'GET'} ${path} → ${res.status}: ${message}`);
      throw new ServiceUnavailableException(`Flutterwave: ${message}`);
    }
    return body?.data as T;
  }

  getPaymentPlan(): Promise<FlwPaymentPlan> {
    if (this.isDemo) {
      return Promise.resolve({
        id: 0,
        name: 'FoodPadi Premium (demo)',
        amount: this.demoNgnAmount,
        interval: 'monthly',
        currency: 'NGN',
        status: 'active',
      });
    }
    return this.request<FlwPaymentPlan>(`/payment-plans/${this.planId}`);
  }

  /**
   * Hosted-checkout link for a subscription. Passing `payment_plan` makes the
   * one-off charge enrol the customer on the recurring plan. `tx_ref` is our
   * own idempotent reference — we store it and match it on the redirect/webhook.
   *
   * In demo mode this returns FoodPadi's own local demo checkout page instead
   * of a Flutterwave URL.
   */
  async createPaymentLink(params: {
    userId: string;
    email: string;
    name?: string | null;
    txRef: string;
    amountNaira: number;
    successUrl: string;
    /** Effective plan id (BillingConfig override, else env). */
    planId?: string | null;
  }): Promise<string> {
    if (this.isDemo) {
      const url = new URL(`${this.webAppUrl}/premium/demo-checkout`);
      url.searchParams.set('tx_ref', params.txRef);
      url.searchParams.set('amount', String(params.amountNaira));
      this.logger.log(`FLW_DEMO_MODE: returning local demo checkout for ${params.txRef}`);
      return url.toString();
    }
    const data = await this.request<{ link: string }>('/payments', {
      method: 'POST',
      body: JSON.stringify({
        tx_ref: params.txRef,
        amount: params.amountNaira,
        currency: 'NGN',
        redirect_url: params.successUrl,
        payment_plan: params.planId ?? this.planId,
        customer: { email: params.email, name: params.name ?? undefined },
        customizations: { title: 'FoodPadi Premium', description: 'Premium — monthly' },
        meta: { foodpadiUserId: params.userId },
      }),
    });
    return data.link;
  }

  /** The demo `transaction_id` is `DEMO-<tx_ref>`, so the tx_ref round-trips. */
  static demoTransactionId(txRef: string): string {
    return `${DEMO_TXN_PREFIX}${txRef}`;
  }

  verifyTransaction(transactionId: string | number): Promise<FlwTransaction> {
    const raw = String(transactionId);
    if (this.isDemo && raw.startsWith(DEMO_TXN_PREFIX)) {
      const txRef = raw.slice(DEMO_TXN_PREFIX.length);
      return Promise.resolve({
        id: 0,
        tx_ref: txRef,
        status: 'successful',
        amount: this.demoNgnAmount,
        currency: 'NGN',
        customer: { id: 0, email: '' },
        payment_plan: 0,
      });
    }
    return this.request<FlwTransaction>(`/transactions/${transactionId}/verify`, { method: 'GET' });
  }

  /** The subscription Flutterwave created for this customer on our plan, if any. */
  async findActiveSubscription(email: string, planId?: string | null): Promise<FlwSubscription | null> {
    if (this.isDemo) {
      return {
        id: 0,
        plan: 0,
        customer: { id: 0, customer_email: email },
        status: 'active',
      };
    }
    const list = await this.request<FlwSubscription[]>(
      `/subscriptions?email=${encodeURIComponent(email)}`,
    ).catch(() => [] as FlwSubscription[]);
    const wantPlan = Number(planId ?? this.planId);
    const match = (list ?? [])
      .filter((s) => s.plan === wantPlan)
      .sort((a, b) => (b.id ?? 0) - (a.id ?? 0))[0];
    return match ?? null;
  }

  async cancelSubscription(subscriptionId: string | number): Promise<void> {
    if (this.isDemo) {
      this.logger.log(`FLW_DEMO_MODE: pretend-cancelled subscription ${subscriptionId}`);
      return;
    }
    await this.request(`/subscriptions/${subscriptionId}/cancel`, { method: 'PUT' });
  }

  /**
   * Flutterwave payment plans are immutable, so an admin price change creates a
   * fresh plan and BillingConfig stores the new id. No-op in demo mode.
   */
  async createPaymentPlan(amountNaira: number): Promise<string> {
    if (this.isDemo) return DEMO_PLAN_ID;
    const data = await this.request<{ id: number }>('/payment-plans', {
      method: 'POST',
      body: JSON.stringify({
        amount: amountNaira,
        name: 'FoodPadi Premium',
        interval: 'monthly',
        currency: 'NGN',
        duration: 0,
      }),
    });
    return String(data.id);
  }

  /**
   * Flutterwave webhook auth is a static shared secret echoed in the
   * `verif-hash` header (set as the "Secret hash" in the dashboard). There is
   * no per-payload HMAC, so this is a constant-time-ish string compare.
   */
  verifyWebhookSignature(headerHash: string | undefined): boolean {
    const expected = process.env.FLW_SECRET_HASH;
    if (!expected || !headerHash) return false;
    return headerHash === expected;
  }

  // -------------------------------------------------------------------------
  // FoodPadi Food Dealer Network — the Nigeria journey for the dealer B2B
  // subscription (a separate product from Premium, dealer brief §13). Its own
  // payment plan (FLW_DEALER_PLAN_ID) and demo checkout page; `meta` carries a
  // dealerId, not a userId. `verifyTransaction` / `findActiveSubscription` /
  // `cancelSubscription` above are product-agnostic and reused as-is.

  get dealerPlanId(): string {
    const id = process.env.FLW_DEALER_PLAN_ID;
    if (this.isDemo) return id || DEMO_PLAN_ID;
    if (!id) throw new ServiceUnavailableException('Dealer subscriptions are not configured on this server.');
    return id;
  }

  get isDealerConfigured(): boolean {
    if (this.isDemo) return true;
    return Boolean(process.env.FLW_SECRET_KEY && process.env.FLW_DEALER_PLAN_ID);
  }

  async createDealerPaymentLink(params: {
    dealerId: string;
    email: string;
    name?: string | null;
    txRef: string;
    amountNaira: number;
    successUrl: string;
    planId?: string | null;
  }): Promise<string> {
    if (this.isDemo) {
      // Relative — the demo checkout page is served by our own web app, so it
      // works whatever port the dev web server is on (see StripeService's
      // createDealerCheckoutSession for the same rationale).
      const qs = new URLSearchParams({
        provider: 'flutterwave',
        tx_ref: params.txRef,
        amount: String(params.amountNaira),
      });
      this.logger.log(`FLW_DEMO_MODE: returning local dealer demo checkout for ${params.txRef}`);
      return `/dealers/onboarding/demo-checkout?${qs.toString()}`;
    }
    const data = await this.request<{ link: string }>('/payments', {
      method: 'POST',
      body: JSON.stringify({
        tx_ref: params.txRef,
        amount: params.amountNaira,
        currency: 'NGN',
        redirect_url: params.successUrl,
        payment_plan: params.planId ?? this.dealerPlanId,
        customer: { email: params.email, name: params.name ?? undefined },
        customizations: {
          title: 'FoodPadi Food Dealer',
          description: 'Food Dealer Network — monthly',
        },
        meta: { foodpadiDealerId: params.dealerId },
      }),
    });
    return data.link;
  }
}
