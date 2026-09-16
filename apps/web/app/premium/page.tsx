import Link from 'next/link';
import {
  PREMIUM_FEATURES,
  countryName,
  type PaymentProvider,
  type PricingView,
  type SubscriptionView,
  type UserSummary,
} from '@foodpadi/shared';
import { redirectToLoginIfUnauthorized, requireSession, serverFetch } from '../../lib/serverApi';
import { AppShell } from '../../components/AppShell';
import { formatMoney, formatPricePerMonth } from '../../lib/money';
import shellStyles from '../app-shell.module.css';
import styles from './premium.module.css';
import { ContinueButton } from './ContinueButton';
import { ManageSubscriptionButton } from './ManageSubscriptionButton';
import { CancelSubscriptionButton } from './CancelSubscriptionButton';
import { CountryPrompt } from './CountryPrompt';

export const dynamic = 'force-dynamic';

export default async function PremiumPage({
  searchParams,
}: {
  searchParams: { checkout?: string; pay?: string };
}) {
  requireSession('/premium');

  // `?pay=usd` lets a customer whom we'd route to a local provider fall back to
  // Stripe / card-in-USD instead — force USD by asking pricing for a US view.
  const forceUsd = searchParams.pay === 'usd';
  const cancelled = searchParams.checkout === 'cancelled';

  let subscription: SubscriptionView | null = null;
  let pricing: PricingView | null = null;
  let me: UserSummary | null = null;
  try {
    [subscription, pricing, me] = await Promise.all([
      serverFetch<SubscriptionView>('/billing/subscription'),
      // No country param — the API resolves it from the user's stored country
      // of residence (set at registration). `?country=US` is only the USD override.
      serverFetch<PricingView>(`/billing/pricing${forceUsd ? '?country=US' : ''}`).catch(() => null),
      serverFetch<UserSummary>('/users/me').catch(() => null),
    ]);
  } catch (e) {
    redirectToLoginIfUnauthorized(e, '/premium');
  }

  const isPremium = subscription?.premium ?? false;
  const needsCountry = !isPremium && !forceUsd && !me?.countryCode;

  return (
    <AppShell guest={false}>
      <main className={shellStyles.shellPage}>
        {isPremium ? (
          <PremiumActiveCard subscription={subscription!} />
        ) : (
          <>
            {needsCountry ? <CountryPrompt /> : null}
            <UpgradeCard
              pricing={pricing}
              cancelled={cancelled}
              forceUsd={forceUsd}
              countryLabel={countryName(me?.countryCode)}
            />
          </>
        )}
      </main>
    </AppShell>
  );
}

function UpgradeCard({
  pricing,
  cancelled,
  forceUsd,
  countryLabel,
}: {
  pricing: PricingView | null;
  cancelled: boolean;
  forceUsd: boolean;
  countryLabel: string | null;
}) {
  const base = pricing?.base ?? { amountCents: 499, currency: 'usd' };
  const local = pricing?.local ?? null;
  const provider: PaymentProvider = forceUsd ? 'stripe' : pricing?.provider ?? 'stripe';
  const isFlutterwave = provider === 'flutterwave';
  const ratesDate = pricing?.ratesUpdatedAt
    ? new Date(pricing.ratesUpdatedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
    : null;

  return (
    <div className={styles.card}>
      <p className={styles.eyebrow}>FoodPadi Premium</p>
      <h1 className={styles.title}>Unlock FoodPadi Premium</h1>
      <p className={styles.lede}>Get more from your food companion:</p>

      <ul className={styles.featureList}>
        {PREMIUM_FEATURES.map((f) => (
          <li key={f} className={styles.feature}>
            <span aria-hidden="true" className={styles.check}>
              ✓
            </span>
            {f}
          </li>
        ))}
      </ul>

      <div className={styles.priceBlock}>
        <span className={styles.price}>{formatPricePerMonth(base, 'en-US')}</span>
        {local ? (
          <span className={styles.priceLocal}>
            {isFlutterwave ? '' : '≈ '}
            {formatMoney(local)}/month
            <span className={styles.estimateTag}>
              {isFlutterwave
                ? 'Billed in ₦ by Flutterwave'
                : ratesDate
                  ? `Estimate · exchange rate ${ratesDate}`
                  : 'Estimated local equivalent'}
            </span>
          </span>
        ) : null}
        {countryLabel && !forceUsd ? (
          <span className={styles.finePrint}>
            Priced for {countryLabel}.{' '}
            <Link href="/profile#country" className={styles.backLink}>
              Change
            </Link>
          </span>
        ) : null}
      </div>

      {cancelled ? (
        <p className={styles.notice}>Checkout cancelled — you haven&apos;t been charged.</p>
      ) : null}

      <ContinueButton provider={provider} />

      {isFlutterwave ? (
        <p className={styles.finePrint}>
          Pay with card, bank transfer or USSD in Naira.{' '}
          <Link href="/premium?pay=usd" className={styles.backLink}>
            Prefer to pay with a card in USD?
          </Link>
        </p>
      ) : null}

      <p className={styles.finePrint}>
        Renews monthly. Cancel anytime. Payments are handled securely by{' '}
        {isFlutterwave ? 'Flutterwave' : 'Stripe'} — FoodPadi never sees your card details.
      </p>
    </div>
  );
}

function PremiumActiveCard({ subscription }: { subscription: SubscriptionView }) {
  const charged = subscription.presentment ?? subscription.base;
  const nextPayment = subscription.currentPeriodEnd
    ? new Date(subscription.currentPeriodEnd).toLocaleDateString(undefined, {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : null;

  return (
    <div className={styles.card}>
      <p className={styles.eyebrow}>FoodPadi Premium</p>
      <h1 className={styles.title}>You&apos;re on FoodPadi Premium</h1>

      <dl className={styles.detailGrid}>
        <div className={styles.detailRow}>
          <dt>Status</dt>
          <dd>
            {subscription.cancelAtPeriodEnd && nextPayment
              ? `Cancelled — active until ${nextPayment}`
              : statusLabel(subscription.status)}
          </dd>
        </div>
        <div className={styles.detailRow}>
          <dt>Price</dt>
          <dd>{formatPricePerMonth(subscription.base, 'en-US')}</dd>
        </div>
        {subscription.presentment ? (
          <div className={styles.detailRow}>
            <dt>You pay</dt>
            <dd>{formatPricePerMonth(charged)}</dd>
          </div>
        ) : null}
        {nextPayment ? (
          <div className={styles.detailRow}>
            <dt>{subscription.cancelAtPeriodEnd ? 'Access until' : 'Next payment'}</dt>
            <dd>{nextPayment}</dd>
          </div>
        ) : null}
        {subscription.trialEndsAt ? (
          <div className={styles.detailRow}>
            <dt>Trial ends</dt>
            <dd>{new Date(subscription.trialEndsAt).toLocaleDateString()}</dd>
          </div>
        ) : null}
      </dl>

      {subscription.canManage ? (
        <ManageSubscriptionButton />
      ) : subscription.canCancel ? (
        <CancelSubscriptionButton nextPayment={nextPayment} />
      ) : (
        <p className={styles.finePrint}>Your billing details will appear here shortly.</p>
      )}

      <p className={styles.finePrint}>
        <Link href="/" className={styles.backLink}>
          ← Back to FoodPadi
        </Link>
      </p>
    </div>
  );
}

function statusLabel(status: SubscriptionView['status']): string {
  switch (status) {
    case 'active':
      return 'Active';
    case 'trialing':
      return 'Free trial';
    case 'past_due':
      return 'Payment overdue';
    case 'canceled':
      return 'Cancelled';
    case 'unpaid':
      return 'Unpaid';
    case 'paused':
      return 'Paused';
    default:
      return 'Active';
  }
}
