import Link from 'next/link';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { ADMIN_SESSION_COOKIE, verifyAdminSessionToken } from '../../lib/adminSession';
import styles from './admin.module.css';

export const metadata = { title: 'Admin — FoodPadi' };

export default function AdminHomePage() {
  const token = cookies().get(ADMIN_SESSION_COOKIE)?.value;
  const staff = verifyAdminSessionToken(token);
  if (!staff) {
    redirect('/admin/login');
  }

  return (
    <main className={styles.main}>
      <div className={styles.dashboardHeader}>
        <div>
          <h1 className={styles.heading}>Admin & support</h1>
          <p className={styles.subtext}>Signed in as {staff.displayName ?? staff.username}</p>
        </div>
        <form action="/api/admin/logout" method="POST">
          <button type="submit" className={styles.linkButton}>
            Sign out
          </button>
        </form>
      </div>

      <Link href="/admin/users" className={`${styles.placeholderCard} ${styles.cardLink}`}>
        <h2>Users</h2>
        <p className={styles.subtext}>Search accounts, view activity, suspend/reactivate, or delete on request.</p>
      </Link>

      <Link href="/admin/waitlist" className={`${styles.placeholderCard} ${styles.cardLink}`}>
        <h2>Waitlist</h2>
        <p className={styles.subtext}>Pre-launch email signups from the landing page.</p>
      </Link>

      <section className={styles.placeholderCard}>
        <h2>Coming next</h2>
        <p className={styles.subtext}>
          Aggregate usage, safety events, feedback triage and subscription lookups from
          docs/ANALYTICS_PLAN.md — once the corresponding admin API endpoints exist on the NestJS
          backend.
        </p>
      </section>
    </main>
  );
}
