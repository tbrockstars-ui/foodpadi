'use client';

import { useEffect, useState } from 'react';
import {
  REFERRAL_TIERS,
  type ReferralShareChannel,
  type ReferralStatus,
  type ReferralSummary,
} from '@foodpadi/shared';
import styles from './invite.module.css';

const SHARE_MESSAGE =
  "🍽️ I found something I think you'd like. FoodPadi helped me decide what to eat.";

function reportShare(channel: ReferralShareChannel) {
  void fetch('/api/proxy/referrals/share', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ channel }),
  }).catch(() => {});
}

const STATUS_LABEL: Record<ReferralStatus, string> = {
  pending: 'Joined',
  qualified: 'Active',
  rewarded: 'Active',
};

export function InviteView({ summary }: { summary: ReferralSummary }) {
  const [copied, setCopied] = useState(false);
  const [canNativeShare, setCanNativeShare] = useState(false);
  const [celebrated, setCelebrated] = useState<typeof summary.unseen>(summary.unseen);

  useEffect(() => {
    setCanNativeShare(typeof navigator !== 'undefined' && typeof navigator.share === 'function');
  }, []);

  // Acknowledge unseen badges once, on mount, so the celebration shows exactly once.
  useEffect(() => {
    if (summary.unseen.length === 0) return;
    void fetch('/api/proxy/referrals/milestones/ack', { method: 'POST' }).catch(() => {});
  }, [summary.unseen.length]);

  const whatsappHref = `https://wa.me/?text=${encodeURIComponent(
    `${SHARE_MESSAGE} Try it: ${summary.link}`,
  )}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(summary.link);
      setCopied(true);
      reportShare('copy');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked (insecure context / permissions) — the link is
      // visible in the field for the user to copy by hand.
    }
  };

  const nativeShare = async () => {
    try {
      await navigator.share({ text: SHARE_MESSAGE, url: summary.link });
      reportShare('native');
    } catch {
      // User dismissed the share sheet — nothing to do.
    }
  };

  const { tier, nextTier, counts } = summary;
  const progressPct = nextTier
    ? Math.min(100, Math.round((counts.qualified / nextTier.threshold) * 100))
    : 100;

  return (
    <>
      {celebrated.length > 0 ? (
        <div className={styles.celebrate} role="status">
          <button
            type="button"
            className={styles.celebrateClose}
            aria-label="Dismiss"
            onClick={() => setCelebrated([])}
          >
            ✕
          </button>
          <p className={styles.celebrateTitle}>Nice work! 🎉</p>
          {celebrated.map((m) => (
            <p key={`${m.kind}-${m.label}`} className={styles.celebrateLine}>
              <span aria-hidden="true">{m.icon} </span>
              {m.kind === 'joined_via_friend'
                ? 'You joined FoodPadi through a friend — welcome!'
                : `You reached ${m.label}`}
            </p>
          ))}
        </div>
      ) : null}

      <div className={styles.card}>
        <p className={styles.sectionLabel}>Your invite link</p>
        <div className={styles.linkRow}>
          <span className={styles.linkField} title={summary.link}>
            {summary.link}
          </span>
          <button
            type="button"
            className={`${styles.copyButton} ${copied ? styles.copied : ''}`}
            onClick={copy}
          >
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
        <div className={styles.shareRow}>
          <a
            className={`${styles.shareButton} ${styles.whatsapp}`}
            href={whatsappHref}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => reportShare('whatsapp')}
          >
            Share on WhatsApp
          </a>
          {canNativeShare ? (
            <button
              type="button"
              className={`${styles.shareButton} ${styles.nativeShare}`}
              onClick={nativeShare}
            >
              Share…
            </button>
          ) : null}
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.statsGrid}>
          <div className={styles.stat}>
            <span className={styles.statValue}>{counts.joined}</span>
            <span className={styles.statLabel}>Friends joined</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statValue}>{counts.qualified}</span>
            <span className={styles.statLabel}>Made a food decision</span>
          </div>
        </div>
        <p className={styles.hint}>
          A friend counts as &ldquo;joined&rdquo; when they register through your link, and moves to
          &ldquo;made a food decision&rdquo; once they&apos;ve actually used FoodPadi to decide,
          cook, or plan.
        </p>
      </div>

      <div className={styles.card}>
        <p className={styles.sectionLabel}>Your referral status</p>
        <p className={styles.tierNow}>
          {tier ? (
            <>
              <span aria-hidden="true">{tier.icon} </span>
              {tier.label}
            </>
          ) : (
            'Not started yet'
          )}
        </p>
        {nextTier ? (
          <>
            <div className={styles.progressTrack}>
              <div className={styles.progressFill} style={{ width: `${progressPct}%` }} />
            </div>
            <p className={styles.hint}>
              {nextTier.remaining} more {nextTier.remaining === 1 ? 'friend' : 'friends'} making a
              food decision to reach <strong>{nextTier.icon} {nextTier.label}</strong>.
            </p>
          </>
        ) : (
          <p className={styles.hint}>You&apos;ve reached the top tier — thank you for spreading FoodPadi.</p>
        )}

        <ul className={styles.ladder}>
          {REFERRAL_TIERS.map((t) => {
            const reached = counts.qualified >= t.threshold;
            return (
              <li key={t.threshold} className={`${styles.ladderItem} ${reached ? styles.ladderReached : ''}`}>
                <span className={styles.ladderIcon} aria-hidden="true">{t.icon}</span>
                <span className={styles.ladderLabel}>{t.label}</span>
                <span className={styles.ladderThreshold}>
                  {t.threshold} {t.threshold === 1 ? 'friend' : 'friends'}
                </span>
              </li>
            );
          })}
        </ul>
      </div>

      <div className={styles.card}>
        <p className={styles.sectionLabel}>Recent invites</p>
        {summary.recent.length === 0 ? (
          <p className={styles.empty}>No one has joined through your link yet.</p>
        ) : (
          <ul className={styles.recentList}>
            {summary.recent.map((item, i) => {
              const active = item.status !== 'pending';
              return (
                <li key={`${item.maskedHandle}-${i}`} className={styles.recentItem}>
                  <span className={styles.recentHandle}>{item.maskedHandle}</span>
                  <span
                    className={`${styles.badge} ${active ? styles.badgeQualified : styles.badgePending}`}
                  >
                    {STATUS_LABEL[item.status]}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </>
  );
}
