import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { ADMIN_SESSION_COOKIE, isValidAdminSessionToken } from '../../lib/adminSession';
import styles from './admin.module.css';

export const metadata = { title: 'Admin — FoodPadi' };

export default function AdminHomePage() {
  const token = cookies().get(ADMIN_SESSION_COOKIE)?.value;
  if (!isValidAdminSessionToken(token)) {
    redirect('/admin/login');
  }

  return (
    <main className={styles.main}>
      <div className={styles.dashboardHeader}>
        <h1 className={styles.heading}>Admin & support</h1>
        <form action="/api/admin/logout" method="POST">
          <button type="submit" className={styles.linkButton}>
            Sign out
          </button>
        </form>
      </div>

      <section className={styles.placeholderCard}>
        <h2>Coming next</h2>
        <p className={styles.subtext}>
          This dashboard will surface the admin/analytics capability from docs/ANALYTICS_PLAN.md
          (aggregate usage, safety events, feedback triage, subscription lookups) and support
          tooling for handling user requests — once the corresponding admin API endpoints exist on
          the NestJS backend. Nothing here reads real user data yet.
        </p>
      </section>
    </main>
  );
}
