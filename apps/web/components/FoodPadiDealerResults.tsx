'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { DealerCardView, DealerSearchResponse } from '@foodpadi/shared';
import { VerifiedBadge } from './VerifiedBadge';
import { StarRating } from './StarRating';
import styles from './FoodPadiDealerResults.module.css';

/**
 * The "FoodPadi Dealers" block shown inside local discovery (Decide → Get It →
 * Find nearby, and Eat Now's Find Near Me). Always rendered ABOVE the external
 * OpenStreetMap results — FoodPadi's own network first (dealer brief §22/§46 +
 * user instruction 2026-09-09) — but it only takes space when a subscribed
 * dealer genuinely matches. No match ⇒ renders nothing and the customer just
 * sees the existing OSM discovery (brief §60/§82).
 *
 * Same GET /dealers/search the mobile app calls (brief §21/§64) — deterministic,
 * no AI, guest-accessible.
 */
export function FoodPadiDealerResults({
  query,
  latitude,
  longitude,
  locationText,
}: {
  query: string;
  latitude?: number;
  longitude?: number;
  locationText?: string;
}) {
  const [data, setData] = useState<DealerSearchResponse | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams();
    if (query.trim()) params.set('q', query.trim());
    if (typeof latitude === 'number' && typeof longitude === 'number') {
      params.set('latitude', String(latitude));
      params.set('longitude', String(longitude));
    }
    if (locationText?.trim()) params.set('locality', locationText.trim());

    fetch(`/api/proxy/dealers/search?${params.toString()}`)
      .then((r) => (r.ok ? (r.json() as Promise<DealerSearchResponse>) : Promise.reject(new Error(String(r.status)))))
      .then((res) => {
        if (!cancelled) setData(res);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [query, latitude, longitude, locationText]);

  if (failed || !data) return null;
  const cards = [...data.featured, ...data.results];
  if (cards.length === 0) return null;

  return (
    <section className={styles.section} aria-label="FoodPadi Dealers">
      <h3 className={styles.heading}>FoodPadi Dealers</h3>
      <p className={styles.sub}>Businesses in the FoodPadi Food Dealer Network near you.</p>
      {cards.map((c) => (
        <DealerResultCard key={c.id} card={c} />
      ))}
    </section>
  );
}

function DealerResultCard({ card }: { card: DealerCardView }) {
  const track = (type: string) => {
    void fetch(`/api/proxy/dealers/${card.slug}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type }),
    }).catch(() => undefined);
  };

  const distance =
    card.distanceMiles != null
      ? `${card.distanceMiles < 0.1 ? 'under 0.1' : card.distanceMiles.toFixed(1)} mi`
      : card.primaryLocality;

  return (
    <div className={`${styles.card} ${card.isSponsored ? styles.cardSponsored : ''}`}>
      {card.isSponsored ? (
        <div className={styles.badges}>
          <span className={styles.sponsored}>Sponsored</span>
        </div>
      ) : null}
      <p className={styles.nameRow}>
        <span className={styles.name}>{card.name}</span>
        {card.isVerified ? <VerifiedBadge /> : null}
      </p>
      <p className={styles.meta}>
        {[card.categories.slice(0, 2).join(' · '), distance].filter(Boolean).join(' — ')}
      </p>
      {card.ratingAverage != null ? (
        <StarRating average={card.ratingAverage} count={card.ratingCount} size={12} />
      ) : null}
      {card.matchedTerms.length > 0 ? (
        <div className={styles.matched}>
          {card.matchedTerms.map((t) => (
            <span key={t} className={styles.matchedChip}>
              {t}
            </span>
          ))}
        </div>
      ) : null}
      <div className={styles.actions}>
        <Link
          href={`/dealer/${card.slug}`}
          className={styles.viewLink}
          onClick={() => track('profile_view')}
        >
          View dealer →
        </Link>
      </div>
    </div>
  );
}
