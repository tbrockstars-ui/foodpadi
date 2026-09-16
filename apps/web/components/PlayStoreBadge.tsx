import styles from './PlayStoreBadge.module.css';

// Set by a human once the app is genuinely live on Play (see
// docs/PLAY_STORE_LISTING.md, "Not yet launch-ready") — apps/web/.env(.example)
// documents this. Never fabricated/guessed here: unset renders a "coming
// soon" state instead of a dead or made-up link.
const PLAY_STORE_URL = process.env.NEXT_PUBLIC_PLAY_STORE_URL;

// A real, installable build (the EAS preview APK) that exists *before* the
// app is actually published to Play — separate from PLAY_STORE_URL above
// deliberately, so "we have something real to hand out" (this) never gets
// conflated with "we're live on the Play Store" (that). Renders its own
// honest "direct APK download" badge rather than Google's Play Store
// artwork, since that artwork's brand guidelines assume it links to an
// actual Play Store listing (user correction, 2026-09-16: the app is real
// and downloadable now, just not through Play yet — the badge shouldn't
// imply Play Store distribution it doesn't have).
const APK_URL = process.env.NEXT_PUBLIC_ANDROID_APK_URL;

// Google's own hosted badge artwork — Play brand guidelines require using it
// unmodified rather than recreating the badge, and hotlinking it is the
// standard, Google-sanctioned way to embed it (no new npm dependency, no
// asset of ours to keep in sync with Google's design updates). Only used for
// a real Play Store link (PLAY_STORE_URL) — never for the direct-APK case.
const BADGE_SRC = 'https://play.google.com/intl/en_us/badges/static/images/badges/en_badge_web_generic.png';

/**
 * The Android download CTA. Reused at all three landing-page placements
 * (hero, product section, final CTA) — see apps/web/app/page.tsx. Three
 * states: a real Play Store link (PLAY_STORE_URL) uses Google's own badge
 * artwork; a real direct-APK link (APK_URL) with no Play listing yet uses a
 * plain, honestly-labelled badge instead; neither set falls back to the same
 * dimmed "Coming soon" state as the iOS waitlist CTA elsewhere on this page.
 */
export function PlayStoreBadge({ className }: { className?: string }) {
  if (PLAY_STORE_URL) {
    return (
      <a
        href={PLAY_STORE_URL}
        target="_blank"
        rel="noopener noreferrer"
        className={`${styles.badge} ${className ?? ''}`}
        aria-label="Get FoodPadi on Google Play"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={BADGE_SRC} alt="Get it on Google Play" className={styles.badgeImg} />
      </a>
    );
  }

  if (APK_URL) {
    return (
      <a
        href={APK_URL}
        target="_blank"
        rel="noopener noreferrer"
        className={`${styles.badge} ${styles.apkBadge} ${className ?? ''}`}
        aria-label="Download the FoodPadi Android app (direct APK download)"
      >
        <svg viewBox="0 0 24 24" className={styles.apkIcon} aria-hidden="true">
          <path
            fill="currentColor"
            d="M17.6 9.48l1.84-3.18c.16-.31.04-.69-.26-.85-.29-.15-.65-.06-.83.22l-1.88 3.24a11.463 11.463 0 00-8.94 0L5.65 5.67c-.19-.28-.55-.37-.84-.22-.3.16-.42.54-.26.85L6.4 9.48C3.3 11.25 1.28 14.44 1 18h22c-.28-3.56-2.3-6.75-5.4-8.52zM7 15.25a1.25 1.25 0 110-2.5 1.25 1.25 0 010 2.5zm10 0a1.25 1.25 0 110-2.5 1.25 1.25 0 010 2.5z"
          />
        </svg>
        <span className={styles.apkText}>
          <span className={styles.apkTextSmall}>Direct download</span>
          <span className={styles.apkTextBig}>Android APK</span>
        </span>
      </a>
    );
  }

  return (
    <span className={`${styles.badge} ${styles.comingSoon} ${className ?? ''}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={BADGE_SRC} alt="FoodPadi on Google Play — coming soon" className={styles.badgeImg} />
      <span className={styles.comingSoonLabel}>Coming soon</span>
    </span>
  );
}
