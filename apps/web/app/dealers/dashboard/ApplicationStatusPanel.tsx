'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import type { DealerView } from '@foodpadi/shared';
import { ResubmitBanner } from './ResubmitBanner';
import { StatusBadge } from './ui';
import styles from '../dealers.module.css';

/**
 * The admin-approval-before-payment lifecycle, dealer-facing (2026-09-11,
 * dealer brief §21/§29/§30/§31): draft is handled by the onboarding redirect
 * before this ever renders; every other status gets its own honest panel.
 * Application state (and subscription state, on the Subscription page)
 * survives logout/login because it's just server data — this component adds
 * no client-only state beyond a one-time "just submitted" banner.
 */
export function ApplicationStatusPanel({ dealer }: { dealer: DealerView }) {
  const router = useRouter();
  const params = useSearchParams();
  const [justSubmitted, setJustSubmitted] = useState(false);

  useEffect(() => {
    if (params.get('submitted') === '1') {
      setJustSubmitted(true);
      router.replace('/dealers/dashboard');
    }
  }, [params, router]);

  if (dealer.listingStatus === 'pending_review') {
    return (
      <div className={styles.panel}>
        <div className={styles.panelHeader}>
          <p className={styles.panelTitle}>Application submitted</p>
          <StatusBadge tone="amber">Pending review</StatusBadge>
        </div>
        {justSubmitted ? (
          <p className={styles.success}>
            Thank you for applying to become a FoodPadi Food Dealer.
          </p>
        ) : null}
        <p className={styles.itemMeta} style={{ marginBottom: 0 }}>
          Your application is currently being reviewed by our team. You do not need to make any
          payment at this stage — we&apos;ll notify you once a decision has been made.
        </p>
      </div>
    );
  }

  if (dealer.listingStatus === 'changes_requested') {
    return (
      <div className={styles.panel}>
        <div className={styles.panelHeader}>
          <p className={styles.panelTitle}>Action required</p>
          <StatusBadge tone="amber">Changes requested</StatusBadge>
        </div>
        <p className={styles.itemMeta}>
          Your FoodPadi application needs a few updates before we can approve it.
        </p>
        <ResubmitBanner
          note={dealer.approvalNote}
          rejected={false}
          secondaryAction={
            <Link href="/dealers/dashboard/profile" className={styles.ctaSecondary}>
              Update application
            </Link>
          }
        />
      </div>
    );
  }

  if (dealer.listingStatus === 'approved') {
    return (
      <div className={styles.panel}>
        <div className={styles.panelHeader}>
          <p className={styles.panelTitle}>🎉 You&apos;re approved!</p>
          <StatusBadge tone="lime">Approved</StatusBadge>
        </div>
        <p className={styles.itemMeta}>
          Your business has been approved to join the FoodPadi Dealer Network. Choose a
          subscription to activate your listing and become discoverable to customers — whenever
          you&apos;re ready.
        </p>
        <Link href="/dealers/dashboard/subscription" className={styles.ctaPrimary}>
          Choose your plan
        </Link>
      </div>
    );
  }

  if (dealer.listingStatus === 'rejected') {
    return (
      <div className={styles.panel}>
        <div className={styles.panelHeader}>
          <p className={styles.panelTitle}>Application not approved</p>
          <StatusBadge tone="red">Rejected</StatusBadge>
        </div>
        <p className={styles.itemMeta}>
          Your FoodPadi Food Dealer application was not approved. If you&apos;ve addressed the
          reason below, correct your profile and resend it — it goes back into the same review
          queue as a fresh application.
        </p>
        <ResubmitBanner
          note={dealer.approvalNote}
          rejected
          secondaryAction={
            <Link href="/dealers/dashboard/profile" className={styles.ctaSecondary}>
              Update application
            </Link>
          }
        />
      </div>
    );
  }

  if (dealer.listingStatus === 'suspended') {
    return (
      <div className={styles.panel}>
        <div className={styles.panelHeader}>
          <p className={styles.panelTitle}>Listing suspended</p>
          <StatusBadge tone="red">Suspended</StatusBadge>
        </div>
        <p className={styles.itemMeta} style={{ marginBottom: 0 }}>
          Your FoodPadi Food Dealer listing is currently suspended and hidden from customer
          search. Contact FoodPadi support for details.
        </p>
      </div>
    );
  }

  return null;
}
