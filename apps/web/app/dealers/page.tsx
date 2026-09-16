import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { DealerView } from '@foodpadi/shared';
import { Logo } from '../../components/Logo';
import { ApiError, isAuthenticated, serverFetch } from '../../lib/serverApi';
import styles from './dealers.module.css';

export const metadata: Metadata = {
  title: 'FoodPadi Food Dealer Network — get discovered by people looking for food',
  description:
    'Join FoodPadi as a Food Dealer and make your products easier to discover when local customers are deciding what to eat. Local discovery, a searchable profile, product listings, Featured visibility and customer contact links.',
  alternates: { canonical: '/dealers' },
};

// Web-only B2B sales page (dealer brief §1 / §69). Public — no auth for the
// pitch itself. But an already-registered dealer landing here is sent straight
// to where they actually want to be (dashboard, or the wizard if still a draft)
// — they don't need the sales pitch again.
export default async function DealerSalesPage() {
  const authed = isAuthenticated();
  const startHref = authed ? '/dealers/onboarding' : '/login?next=%2Fdealers%2Fonboarding';

  let existingDealer: DealerView | null = null;
  if (authed) {
    try {
      existingDealer = await serverFetch<DealerView>('/dealers/me');
    } catch (e) {
      // 404 = no dealer yet → show the pitch. 401 = stale session → also show
      // the pitch (the CTA routes through /login). Anything else is a real error.
      if (!(e instanceof ApiError && (e.status === 404 || e.status === 401))) throw e;
    }
  }
  // redirect() throws NEXT_REDIRECT — call it OUTSIDE the try so the catch above
  // can't swallow it (same rule as serverApi's redirectToLoginIfUnauthorized).
  if (existingDealer) {
    redirect(existingDealer.listingStatus === 'draft' ? '/dealers/onboarding' : '/dealers/dashboard');
  }

  return (
    <div className={styles.wrap}>
      <header className={styles.topbar}>
        <Logo href="/" size={30} withWordmark />
        <nav className={styles.topbarLinks}>
          <Link href="/">FoodPadi for customers</Link>
          {authed ? <Link href="/dealers/dashboard">Dealer dashboard</Link> : <Link href="/login">Sign in</Link>}
        </nav>
      </header>

      <section className={styles.hero}>
        <p className={styles.heroEyebrow}>FoodPadi Food Dealer Network</p>
        <h1 className={styles.heroTitle}>Get discovered by people looking for food near you.</h1>
        <p className={styles.heroSub}>
          Join the FoodPadi Food Dealer Network and make your business easier to discover when
          customers are deciding what to eat or looking for food locally.
        </p>

        <ul className={styles.benefits}>
          <li>Local FoodPadi discovery</li>
          <li>A searchable dealer profile</li>
          <li>Products and categories</li>
          <li>Featured / Sponsored visibility for relevant searches</li>
          <li>FoodPadi local search optimisation</li>
          <li>Customer contact and ordering links</li>
          <li>A dealer dashboard with basic discovery analytics</li>
        </ul>

        <div className={styles.ctaRow}>
          <Link href={startHref} className={styles.ctaPrimary}>
            Apply to become a Food Dealer
          </Link>
        </div>

        <p className={styles.finePrint}>
          FoodPadi reviews every application before a dealer is ever offered a subscription — you
          never pay to be reviewed. Once approved, your subscription makes your business a FoodPadi
          Dealer and eligible for Featured placement in relevant FoodPadi searches. It is not a
          guarantee of a #1 position, and search-engine (Google) rankings remain outside
          FoodPadi&apos;s control. Payment can increase visibility — it never makes an irrelevant
          result appear relevant, and it never buys approval.
        </p>
      </section>

      <section className={styles.trustGrid}>
        <div className={styles.trustCard}>
          <h3>1. Apply</h3>
          <p>Tell us about your business, products, location and how customers can reach you.</p>
        </div>
        <div className={styles.trustCard}>
          <h3>2. Get approved</h3>
          <p>FoodPadi reviews every application before any payment is ever offered.</p>
        </div>
        <div className={styles.trustCard}>
          <h3>3. Choose your subscription</h3>
          <p>Once approved, pick a plan whenever you&apos;re ready — there&apos;s no rush.</p>
        </div>
        <div className={styles.trustCard}>
          <h3>4. Become discoverable</h3>
          <p>Your listing goes live on FoodPadi web and mobile, eligible for Featured placement.</p>
        </div>
      </section>

      <section className={styles.trustGrid}>
        <div className={styles.trustCard}>
          <h3>Relevance first</h3>
          <p>
            A subscribed dealer only appears when the search genuinely matches its products,
            categories and area. Paid placement is always clearly labelled &ldquo;Sponsored&rdquo;.
          </p>
        </div>
        <div className={styles.trustCard}>
          <h3>You keep your channels</h3>
          <p>
            FoodPadi sends customers to your existing phone, website or ordering link. We don&apos;t
            take orders or a commission on them.
          </p>
        </div>
        <div className={styles.trustCard}>
          <h3>Web &amp; mobile</h3>
          <p>
            Your profile is discoverable to customers on both the FoodPadi website and the mobile
            app from the same listing.
          </p>
        </div>
      </section>
    </div>
  );
}
