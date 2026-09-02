'use client';

import { useEffect, useState } from 'react';
import type { ReferralNudgeContext, ReferralShareChannel } from '@foodpadi/shared';
import styles from './ShareNudge.module.css';

const COPY: Record<ReferralNudgeContext, { text: string; message: string }> = {
  decision: {
    text: 'Found something good? Your friend might be wondering what to eat too.',
    message: "🍽️ FoodPadi just helped me decide what to eat. Try it:",
  },
  cook: {
    text: 'Cooked something good? Send FoodPadi to someone who never knows what to eat.',
    message: '👨‍🍳 FoodPadi sorted out what I’m cooking tonight. Try it:',
  },
  plan: {
    text: 'Planning your week? Help a friend plan theirs.',
    message: '📅 I’m planning my meals with FoodPadi. Try it:',
  },
};

function reportShare(channel: ReferralShareChannel) {
  void fetch('/api/proxy/referrals/share', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ channel }),
  }).catch(() => {});
}

/**
 * A compact "share FoodPadi" prompt shown at a moment food naturally becomes
 * social — after a decision, after cooking, after planning (strategy §4).
 * Referral is a key acquisition channel, so these live in the product flow,
 * not just the /invite page. Logged-in users only (a guest has no code).
 * Shows once per browser session per context, and is dismissible.
 */
export function ShareNudge({ context }: { context: ReferralNudgeContext }) {
  const storageKey = `fp_sharenudge_${context}`;
  const [link, setLink] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(true); // assume hidden until we've checked
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let seen = false;
    try {
      seen = sessionStorage.getItem(storageKey) === '1';
    } catch {
      // sessionStorage unavailable — treat as not-seen, just don't persist.
    }
    if (seen) return;
    setDismissed(false);

    let active = true;
    fetch('/api/proxy/referrals/link')
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { link?: string } | null) => {
        if (active && data?.link) setLink(data.link);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [storageKey]);

  const dismiss = () => {
    setDismissed(true);
    try {
      sessionStorage.setItem(storageKey, '1');
    } catch {
      /* ignore */
    }
  };

  if (dismissed || !link) return null;

  const { text, message } = COPY[context];
  const whatsappHref = `https://wa.me/?text=${encodeURIComponent(`${message} ${link}`)}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      reportShare('copy');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked — nothing to do */
    }
  };

  return (
    <div className={styles.card}>
      <button type="button" className={styles.dismiss} aria-label="Dismiss" onClick={dismiss}>
        ✕
      </button>
      <p className={styles.text}>{text}</p>
      <div className={styles.actions}>
        <a
          className={`${styles.button} ${styles.whatsapp}`}
          href={whatsappHref}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => {
            reportShare('whatsapp');
            dismiss();
          }}
        >
          Share on WhatsApp
        </a>
        <button type="button" className={`${styles.button} ${styles.copy} ${copied ? styles.copied : ''}`} onClick={copy}>
          {copied ? 'Link copied' : 'Copy link'}
        </button>
      </div>
    </div>
  );
}
