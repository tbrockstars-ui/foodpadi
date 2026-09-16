import Link from 'next/link';
import { PlayStoreBadge } from './PlayStoreBadge';
import styles from './AppDownloadSection.module.css';

/**
 * The "take FoodPadi with you" pairing of download CTAs — reused for both
 * the product-section and final-CTA landing-page placements (page.tsx).
 * Android and iOS are always shown together and are always separate actions
 * (never merged into one button): Android gets the real Play Store badge
 * (or a "coming soon" state — see PlayStoreBadge), iOS gets the existing
 * waitlist page's own CTA rather than a second waitlist form embedded here.
 */
export function AppDownloadSection({ heading }: { heading: string }) {
  return (
    <div className={styles.wrap}>
      <h2 className={styles.heading}>{heading}</h2>
      <div className={styles.cards}>
        <div className={styles.card}>
          <p className={styles.brand}>FoodPadi</p>
          <p className={styles.tagline}>Get FoodPadi on Android</p>
          <PlayStoreBadge />
        </div>
        <div className={styles.card}>
          <p className={styles.brand}>FoodPadi for iPhone</p>
          <p className={styles.tagline}>FoodPadi for iPhone is coming.</p>
          <Link href="/ios-waitlist" className={styles.iosButton}>
            Join the iOS Waitlist
          </Link>
        </div>
      </div>
    </div>
  );
}
