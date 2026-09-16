import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { DealerProfileView } from '@foodpadi/shared';
import { DEALER_TYPE_LABELS } from '@foodpadi/shared';
import { DealerContactActions } from './DealerContactActions';
import { DealerRatings } from './DealerRatings';
import { VerifiedBadge } from '../../../components/VerifiedBadge';
import { StarRating } from '../../../components/StarRating';
import styles from './dealer.module.css';

const API_URL = process.env.API_URL ?? 'http://localhost:4310';

async function loadDealer(slug: string): Promise<DealerProfileView | null> {
  try {
    const res = await fetch(`${API_URL}/dealers/${encodeURIComponent(slug)}`, { cache: 'no-store' });
    if (!res.ok) return null;
    return (await res.json()) as DealerProfileView;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const dealer = await loadDealer(params.slug);
  if (!dealer) return { title: 'Dealer not found — FoodPadi' };
  const where = dealer.primaryLocality ? ` in ${dealer.primaryLocality}` : '';
  const cats = dealer.categories.slice(0, 3).join(', ');
  return {
    title: `${dealer.name}${where} — FoodPadi Food Dealer`,
    description:
      dealer.description?.slice(0, 155) ||
      `${dealer.name}${where}: ${cats || DEALER_TYPE_LABELS[dealer.dealerType]}. Find products, contact and directions on FoodPadi.`,
    alternates: { canonical: `/dealer/${dealer.slug}` },
    openGraph: { title: `${dealer.name}${where}`, type: 'website' },
  };
}

// Public, indexable dealer page (dealer brief §27/§34). Real database content
// only — every contact/order channel is one the dealer actually supplied.
export default async function DealerPage({ params }: { params: { slug: string } }) {
  const dealer = await loadDealer(params.slug);
  if (!dealer) notFound();

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: dealer.name,
    description: dealer.description ?? undefined,
    telephone: dealer.contact.phone ?? undefined,
    url: dealer.contact.websiteUrl ?? undefined,
    address: dealer.primaryLocality
      ? { '@type': 'PostalAddress', addressLocality: dealer.primaryLocality, addressCountry: 'GB' }
      : undefined,
    makesOffer: dealer.products.slice(0, 20).map((p) => ({
      '@type': 'Offer',
      itemOffered: { '@type': 'Product', name: p.name },
    })),
    // Real aggregate from genuine customer ratings only — never fabricated.
    aggregateRating:
      dealer.ratingAverage != null
        ? {
            '@type': 'AggregateRating',
            ratingValue: dealer.ratingAverage,
            reviewCount: dealer.ratingCount,
          }
        : undefined,
  };

  return (
    <main className={styles.page}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <Link href="/" className={styles.backLink}>
        ‹ Back to FoodPadi
      </Link>
      <p className={styles.crumb}>FoodPadi Food Dealer Network</p>

      <h1 className={styles.name}>
        {dealer.name}
        {dealer.isVerified ? <VerifiedBadge size={20} className={styles.nameBadge} /> : null}
      </h1>
      <p className={styles.meta}>
        {[DEALER_TYPE_LABELS[dealer.dealerType], ...dealer.categories].filter(Boolean).join(' • ')}
      </p>
      {dealer.primaryLocality ? <p className={styles.meta}>📍 {dealer.primaryLocality}</p> : null}
      {dealer.ratingAverage != null ? (
        <p className={styles.meta}>
          <StarRating average={dealer.ratingAverage} count={dealer.ratingCount} size={15} />
        </p>
      ) : null}

      <DealerContactActions slug={dealer.slug} contact={dealer.contact} locality={dealer.primaryLocality} />

      {dealer.products.length > 0 ? (
        <section className={styles.section}>
          <h2 className={styles.h2}>Popular products</h2>
          <ul className={styles.productList}>
            {dealer.products.map((p) => (
              <li key={p.name}>
                <span>{p.name}</span>
                {p.priceText ? <span className={styles.price}>{p.priceText}</span> : null}
                {p.available === false ? <span className={styles.unavailable}>Unavailable</span> : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {dealer.description ? (
        <section className={styles.section}>
          <h2 className={styles.h2}>About</h2>
          <p>{dealer.description}</p>
        </section>
      ) : null}

      {dealer.openingHours ? (
        <section className={styles.section}>
          <h2 className={styles.h2}>Opening hours</h2>
          <ul className={styles.hours}>
            {Object.entries(dealer.openingHours).map(([day, v]) => (
              <li key={day}>
                <span className={styles.day}>{day}</span>
                <span>{v}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {dealer.serviceAreas.length > 0 ? (
        <section className={styles.section}>
          <h2 className={styles.h2}>Also serves</h2>
          <p className={styles.meta}>{dealer.serviceAreas.join(', ')}</p>
        </section>
      ) : null}

      <DealerRatings slug={dealer.slug} />

      <p className={styles.report}>
        Something wrong with this listing?{' '}
        <Link href={`/dealer/${dealer.slug}/report`}>Report it</Link>
      </p>
    </main>
  );
}
