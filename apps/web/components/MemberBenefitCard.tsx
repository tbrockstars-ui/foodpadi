import Link from 'next/link';
import styles from './MemberBenefitCard.module.css';

interface Props {
  /** Leading emoji, e.g. "✨" / "🔖" / "🧠" / "🗓". */
  icon?: string;
  title: string;
  body: string;
  /** Optional benefit checklist (guest-mode brief §8/§20). */
  bullets?: string[];
  ctaLabel: string;
  ctaHref?: string;
  className?: string;
}

/**
 * The contextual "let FoodPadi remember you" card (guest-mode brief §20) —
 * web twin of apps/mobile/src/components/MemberBenefitCard.tsx. Inline and
 * non-blocking; the caller decides how often it appears (lib/guestClient.ts).
 */
export function MemberBenefitCard({
  icon,
  title,
  body,
  bullets,
  ctaLabel,
  ctaHref = '/register',
  className,
}: Props) {
  return (
    <div className={[styles.card, className].filter(Boolean).join(' ')}>
      <p className={styles.title}>
        {icon ? <span aria-hidden="true">{icon} </span> : null}
        {title}
      </p>
      <p className={styles.body}>{body}</p>
      {bullets && bullets.length > 0 ? (
        <ul className={styles.bullets}>
          {bullets.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      ) : null}
      <Link href={ctaHref} className={styles.cta}>
        {ctaLabel}
      </Link>
    </div>
  );
}
