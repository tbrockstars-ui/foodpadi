import styles from './PlayStoreBadge.module.css';

// Set by a human once a real iOS listing exists — apps/web/.env(.example)
// documents this. FoodPadi has no iOS build yet (Android is the launch
// platform — user instruction 2026-09-16: "it is the PlayStore that is
// live, and iOS is coming soon"), so unset renders a "coming soon" state
// instead of a dead or made-up link, same posture as PlayStoreBadge.
const APP_STORE_URL = process.env.NEXT_PUBLIC_APP_STORE_URL;

// Apple's own hosted badge artwork — same reasoning as PlayStoreBadge's
// Google hotlink: brand guidelines require using it unmodified, and this is
// Apple's official, stable asset URL.
const BADGE_SRC = 'https://developer.apple.com/assets/elements/badges/download-on-the-app-store.svg';

/** The iOS/App Store badge — see PlayStoreBadge for the Android equivalent. */
export function AppStoreBadge({ className }: { className?: string }) {
  if (!APP_STORE_URL) {
    return (
      <span className={`${styles.badge} ${styles.comingSoon} ${className ?? ''}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={BADGE_SRC} alt="FoodPadi on the App Store — coming soon" className={styles.badgeImg} />
        <span className={styles.comingSoonLabel}>Coming soon</span>
      </span>
    );
  }
  return (
    <a
      href={APP_STORE_URL}
      target="_blank"
      rel="noopener noreferrer"
      className={`${styles.badge} ${className ?? ''}`}
      aria-label="Download on the App Store"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={BADGE_SRC} alt="Download on the App Store" className={styles.badgeImg} />
    </a>
  );
}
