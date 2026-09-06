import Link from 'next/link';
import { isGuest, requireSessionOrGuest } from '../../lib/serverApi';
import { AppShell } from '../../components/AppShell';
import shellStyles from '../app-shell.module.css';
import styles from './pantry.module.css';

/**
 * A dedicated "Pantry" landing in the sidebar (matches the reference design)
 * that points at the real ingredients-you-have picker, which already lives
 * as the first step of Cook Today (CookTodayForm) rather than being
 * duplicated here — this is a thin bridge, not a second implementation of
 * that flow.
 */
export default async function PantryPage() {
  requireSessionOrGuest('/pantry');
  const guest = isGuest();

  return (
    <AppShell guest={guest}>
      <main className={shellStyles.shellPage}>
        <h1 className={styles.title}>Pantry</h1>
        <p className={styles.lede}>
          Tell FoodPadi what&apos;s in your kitchen and it&apos;ll turn that into something to cook —
          the same ingredient picker that powers Cook Today.
        </p>
        <Link href="/cook-today" className={styles.cta}>
          See what you have →
        </Link>
      </main>
    </AppShell>
  );
}
