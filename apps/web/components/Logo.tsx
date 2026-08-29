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
  const content = (
    <span className={`${styles.logo} ${onDark ? styles.onDark : ''} ${className ?? ''}`}>
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
    </span>
  );

  if (href) {
    return (
      <Link href={href} aria-label="FoodPadi home">
        {content}
      </Link>
    );
  }

  return content;
}
