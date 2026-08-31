import Image from 'next/image';
import Link from 'next/link';
import styles from './Logo.module.css';

interface LogoProps {
  /** Diameter of the circular mark, in px. */
  size?: number;
  /** Show the "FoodPadi" wordmark next to the mark. */
  withWordmark?: boolean;
  /** Use light text for the wordmark (hero sits on the dark-green background). */
  onDark?: boolean;
  /** Wrap in a link to "/" (skip on pages that already are "/"). */
  href?: string;
  className?: string;
}

/**
 * The real FoodPadi badge (apps/web/public/decor/logo.png — cropped from the
 * user-provided images/FoodPadi_logo.JPG) rendered as a small circular mark,
 * optionally with the wordmark beside it. Shared between the landing page's
 * hero top bar and the login page so both use the same asset consistently.
 */
export function Logo({ size = 44, withWordmark = true, onDark = false, href, className }: LogoProps) {
  const inner = (
    <>
      <Image
        src="/decor/logo.png"
        alt="FoodPadi"
        width={size}
        height={size}
        className={styles.mark}
        style={{ width: size, height: size }}
        priority
      />
      {withWordmark ? <span className={styles.wordmark}>FoodPadi</span> : null}
    </>
  );

  // The linked form is a block-level flex row (not an inline <a>), so when a
  // page renders <Logo> above a <BackLink> they stack on separate lines
  // instead of colliding side by side. `className` (e.g. shellStyles.pageLogo,
  // which adds the gap below) therefore goes on the link itself.
  if (href) {
    return (
      <Link
        href={href}
        aria-label="FoodPadi home"
        className={`${styles.logoLink} ${onDark ? styles.onDark : ''} ${className ?? ''}`}
      >
        {inner}
      </Link>
    );
  }

  return <span className={`${styles.logo} ${onDark ? styles.onDark : ''} ${className ?? ''}`}>{inner}</span>;
}
