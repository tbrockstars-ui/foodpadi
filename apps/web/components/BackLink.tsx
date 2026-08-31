import Link from 'next/link';
import styles from './BackLink.module.css';

/**
 * The "‹ Home" / "‹ Cook Today" pattern repeated (with a bare "‹" glyph and
 * no styling beyond muted text) across every page's top-left corner —
 * consolidated into one component so all of them look and feel the same,
 * and so a redesign is a one-file change instead of six.
 */
export function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className={styles.backLink}>
      <svg className={styles.icon} width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path d="M10 12.5 5.5 8 10 3.5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {label}
    </Link>
  );
}
