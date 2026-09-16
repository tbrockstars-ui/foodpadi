import Link from 'next/link';
import { PREMIUM_FEATURES } from '@foodpadi/shared';
import styles from './PremiumUpsellCard.module.css';

/**
 * The "Unlock FoodPadi Premium" prompt (task STEP 1). Drop this in front of any
 * feature that becomes premium-only. It is intentionally NOT placed on any
 * feature screen yet — which member features get gated is a separate decision;
 * this is the ready-made prompt for when that list exists.
 */
export function PremiumUpsellCard({
  heading = 'Unlock FoodPadi Premium',
  blurb = 'Get more from your food companion:',
  features = PREMIUM_FEATURES,
  ctaHref = '/premium',
  ctaLabel = 'Start Premium',
}: {
  heading?: string;
  blurb?: string;
  features?: readonly string[];
  ctaHref?: string;
  ctaLabel?: string;
}) {
  return (
    <div className={styles.card}>
      <p className={styles.eyebrow}>FoodPadi Premium</p>
      <h3 className={styles.heading}>{heading}</h3>
      <p className={styles.blurb}>{blurb}</p>
      <ul className={styles.list}>
        {features.map((f) => (
          <li key={f} className={styles.item}>
            <span aria-hidden="true" className={styles.check}>
              ✓
            </span>
            {f}
          </li>
        ))}
      </ul>
      <p className={styles.price}>$4.99/month</p>
      <Link href={ctaHref} className={styles.cta}>
        {ctaLabel}
      </Link>
      <p className={styles.finePrint}>Cancel anytime.</p>
    </div>
  );
}
