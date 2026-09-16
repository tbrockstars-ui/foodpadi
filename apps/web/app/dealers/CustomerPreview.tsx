'use client';

import { DEALER_TYPE_LABELS, type DealerProfileView } from '@foodpadi/shared';
import { VerifiedBadge } from '../../components/VerifiedBadge';
import styles from './dealers.module.css';

// "This is how customers will see you" (dealer brief §50) — renders the same
// DealerProfileView the customer-facing /dealer/[slug] page and search cards
// use, so the dealer buys exactly what they preview.
export function CustomerPreview({
  profile,
  sponsored = true,
}: {
  profile: DealerProfileView;
  sponsored?: boolean;
}) {
  const c = profile.contact;
  return (
    <div className={styles.previewCard}>
      {sponsored ? (
        <div className={styles.previewBadges}>
          <span className={styles.badgeSponsored}>Sponsored</span>
        </div>
      ) : null}
      <h3 style={{ margin: '0 0 2px', fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: 6 }}>
        {profile.name || 'Your business name'}
        {profile.isVerified ? <VerifiedBadge /> : null}
      </h3>
      <p className={styles.itemMeta}>
        {[DEALER_TYPE_LABELS[profile.dealerType], ...profile.categories].filter(Boolean).join(' • ')}
      </p>
      {profile.primaryLocality ? <p className={styles.itemMeta}>📍 {profile.primaryLocality}</p> : null}

      {profile.products.length > 0 ? (
        <>
          <p className={styles.fieldLabel} style={{ marginTop: 'var(--space-md)' }}>
            Popular products
          </p>
          <div className={styles.previewProducts}>
            {profile.products.slice(0, 8).map((p) => (
              <span key={p.name} className={styles.chip}>
                {p.name}
                {p.priceText ? ` · ${p.priceText}` : ''}
              </span>
            ))}
          </div>
        </>
      ) : null}

      {profile.description ? (
        <p style={{ marginTop: 'var(--space-md)' }}>{profile.description}</p>
      ) : null}

      <div className={styles.rowActions}>
        {c.phone ? <span className={styles.chip}>Call {c.phone}</span> : null}
        {c.websiteUrl ? <span className={styles.chip}>Website</span> : null}
        {c.orderUrl ? <span className={styles.chip}>Order</span> : null}
        {profile.primaryLocality ? <span className={styles.chip}>Get directions</span> : null}
        {c.whatsappUrl ? <span className={styles.chip}>WhatsApp</span> : null}
      </div>
      {!c.phone && !c.websiteUrl && !c.orderUrl && !c.whatsappUrl ? (
        <p className={styles.error}>Add at least one contact method so customers can reach you.</p>
      ) : null}
    </div>
  );
}
