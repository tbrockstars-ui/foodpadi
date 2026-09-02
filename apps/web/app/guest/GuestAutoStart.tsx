'use client';

import { useEffect, useState } from 'react';
import { Logo } from '../../components/Logo';
import { AiThinking } from '../../components/motion/AiThinking';
import styles from './guest.module.css';

/**
 * Renders whenever /guest loads without a guest session cookie present yet
 * — a shared link or bookmark with no session at all, or (now that
 * TryFoodPadiButton navigates immediately instead of waiting for its own
 * guest-start request to finish first) a brief moment right after clicking
 * "Try FoodPadi", if that background request hasn't landed yet. Either way
 * this starts the session and reloads so the server re-renders this route
 * as the real guest Home. Usually visible for a moment at most, but styled
 * with the same logo/tokens/branded-loading language as the rest of the
 * app rather than a bare loading string, since it's still real FoodPadi UI
 * a visitor sees.
 */
export function GuestAutoStart() {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void fetch('/api/guest/start', { method: 'POST' })
      .then((res) => {
        if (cancelled) return;
        if (!res.ok) {
          setFailed(true);
          return;
        }
        window.location.reload();
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className={styles.container}>
      <Logo size={56} />
      {failed ? (
        <>
          <p className={styles.message}>Could not start FoodPadi. Please try again.</p>
          <a href="/guest" className={styles.retryLink}>
            Try again
          </a>
        </>
      ) : (
        <AiThinking label="Let's Eat!" />
      )}
    </main>
  );
}
