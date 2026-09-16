'use client';

import { useEffect, useState } from 'react';
import styles from './CookieNotice.module.css';

const ACK_KEY = 'foodpadi-cookie-notice-ack';

/**
 * A simple notice, not a consent manager — FoodPadi currently uses only
 * strictly-necessary storage (session/auth cookies, a theme preference, a
 * referral-attribution cookie; see /legal/cookies), and strictly-necessary
 * storage doesn't require opt-in consent under UK PECR. This exists so
 * visitors know that up front, with a link to the real policy. The moment
 * any non-essential (analytics/advertising) technology is added, this needs
 * to become a real accept/reject control, not just a dismissible notice.
 */
export function CookieNotice() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(ACK_KEY)) setShow(true);
    } catch {
      // Storage unavailable (private mode, blocked) — fail open by staying
      // hidden rather than showing a notice that can never be dismissed.
    }
  }, []);

  const dismiss = () => {
    setShow(false);
    try {
      localStorage.setItem(ACK_KEY, '1');
    } catch {
      /* best-effort only */
    }
  };

  if (!show) return null;

  return (
    <div className={styles.bar} role="status">
      <p className={styles.text}>
        FoodPadi uses only essential cookies to keep you signed in and remember your preferences —
        no advertising or tracking. See our{' '}
        <a href="/legal/cookies" className={styles.link}>
          Cookie Policy
        </a>
        .
      </p>
      <button type="button" className={styles.button} onClick={dismiss}>
        Got it
      </button>
    </div>
  );
}
