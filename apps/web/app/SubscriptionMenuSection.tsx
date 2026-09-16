'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { SubscriptionView } from '@foodpadi/shared';
import styles from './settings.module.css';

/**
 * The Subscription block inside the header Settings menu. Replaces the old
 * "Paid plans aren't available yet" placeholder with the real plan state from
 * GET /billing/subscription. Fails safe: if the fetch errors it just offers
 * the upgrade link.
 */
export function SubscriptionMenuSection({ onNavigate }: { onNavigate: () => void }) {
  const [sub, setSub] = useState<SubscriptionView | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch('/api/proxy/billing/subscription')
      .then((r) => (r.ok ? r.json() : null))
      .then((data: SubscriptionView | null) => {
        if (alive) {
          setSub(data);
          setLoaded(true);
        }
      })
      .catch(() => {
        if (alive) setLoaded(true);
      });
    return () => {
      alive = false;
    };
  }, []);

  const premium = sub?.premium ?? false;
  const nextPayment =
    sub?.currentPeriodEnd &&
    new Date(sub.currentPeriodEnd).toLocaleDateString(undefined, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });

  return (
    <>
      <p className={styles.sectionLabel}>Subscription</p>
      <div className={styles.infoRow}>
        <span className={styles.infoKey}>Plan</span>
        <span className={styles.planBadge}>{premium ? 'Premium' : 'Free'}</span>
      </div>

      {premium ? (
        <>
          {sub?.cancelAtPeriodEnd && nextPayment ? (
            <p className={styles.muted}>Cancelled — Premium active until {nextPayment}.</p>
          ) : nextPayment ? (
            <p className={styles.muted}>Next payment {nextPayment}.</p>
          ) : null}
          <Link href="/premium" className={styles.item} role="menuitem" onClick={onNavigate}>
            Manage subscription
          </Link>
        </>
      ) : (
        <>
          <p className={styles.muted}>
            {loaded
              ? 'Unlock personalised planning, AI food help and more for $4.99/month.'
              : 'Loading…'}
          </p>
          <Link href="/premium" className={styles.item} role="menuitem" onClick={onNavigate}>
            Upgrade to Premium
          </Link>
        </>
      )}
    </>
  );
}
