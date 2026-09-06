import Image from 'next/image';
import Link from 'next/link';
import styles from './Logo.module.css';

interface LogoProps {
  /** Diameter of the circular mark, in px. */
  size?: number;
  /** Wordmark font size in px. Defaults to the CSS value (19px); pass this to
      keep the lockup balanced when `size` is larger than usual. */
  wordmarkSize?: number;
  /** Show the "FoodPadi" wordmark next to the mark. */
  withWordmark?: boolean;
  /** Use light text for the wordmark (hero sits on the dark-green background). */
  onDark?: boolean;
  /** Wrap in a link to "/" (skip on pages that already are "/"). */
  href?: string;
  className?: string;
  /** Eager-load + high fetch priority. Only true where this mark IS the LCP
      element (e.g. the big login/register badge) — a small header mark is not,
      and `priority` there just steals bandwidth from real above-the-fold
      content on that route. */
  priority?: boolean;
}

/**
 * The real FoodPadi badge (apps/web/public/decor/logo.png — cropped from the
 * user-provided images/FoodPadi_logo.JPG) rendered as a small circular mark,
 * optionally with the wordmark beside it. Shared between the landing page's
 * hero top bar and the login page so both use the same asset consistently.
 */
export function Logo({
  size = 53, // 44 + 20%
  wordmarkSize,
  withWordmark = true,
  onDark = false,
  href,
  className,
  priority = false,
}: LogoProps) {
  const inner = (
    <>
      <Image
        src="/decor/logo.png"
        alt="FoodPadi"
        width={size}
        height={size}
        sizes={`${size}px`}
        className={styles.mark}
        style={{ width: size, height: size }}
        priority={priority}
        loading={priority ? undefined : 'lazy'}
      />
      {withWordmark ? (
        <span
          className={styles.wordmark}
          style={wordmarkSize ? { fontSize: wordmarkSize } : undefined}
        >
          FoodPadi
        </span>
      ) : null}
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
