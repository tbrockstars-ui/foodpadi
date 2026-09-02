'use client';

import { useEffect, useState } from 'react';
import type { ReferralReceivedStatus } from '@foodpadi/shared';
import styles from './FriendWelcomeBanner.module.css';

/**
 * "Feed a Friend", friend side (strategy §3): a one-time warm welcome for
 * someone who joined through an invite link. Recognition, not a paid perk —
 * see docs/REFERRAL_PLAN.md §3. Self-fetches so it can drop into the
 * server-rendered HomeHub; shows once, then acks server-side.
 */
export function FriendWelcomeBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    let active = true;
    fetch('/api/proxy/referrals/received')
      .then((r) => (r.ok ? r.json() : null))
      .then((data: ReferralReceivedStatus | null) => {
        if (active && data?.unseenWelcome) setShow(true);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const dismiss = () => {
    setShow(false);
    void fetch('/api/proxy/referrals/received/ack', { method: 'POST' }).catch(() => {});
  };

  if (!show) return null;

  return (
    <div className={styles.banner} role="status">
      <button type="button" className={styles.close} aria-label="Dismiss" onClick={dismiss}>
        ✕
      </button>
      🎁 You joined FoodPadi through a friend — welcome! Deciding, cooking and planning are all here
      whenever you don&apos;t know what to eat.
    </div>
  );
}
