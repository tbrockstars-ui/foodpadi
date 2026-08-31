import Link from 'next/link';
import { adminServerFetch, requireAdminSession } from '../../lib/adminApi';
import { TrendChart } from './TrendChart';
import type { AdminAnalyticsOverview } from './types';
import styles from './admin.module.css';

export const metadata = { title: 'Admin — FoodPadi' };

export default async function AdminHomePage() {
  requireAdminSession();
  const overview = await adminServerFetch<AdminAnalyticsOverview>('/admin/analytics/overview');

  return (
    <main className={styles.pageMain}>
      <h1 className={styles.heading}>Overview</h1>
      <p className={styles.subtext}>Key numbers across FoodPadi, refreshed on every visit.</p>

      <section className={styles.statsGrid}>
        <StatCard
          label="Total users"
          value={overview.users.total}
          sub={`${overview.users.active} active · ${overview.users.suspended} suspended`}
        />
        <StatCard
          label="New users (7d)"
          value={overview.users.newLast7Days}
          sub={`${overview.users.newLast30Days} in the last 30 days`}
          positive={overview.users.newLast7Days > 0}
        />
        <StatCard
          label="Waitlist signups"
          value={overview.waitlist.total}
          sub={`+${overview.waitlist.newLast7Days} this week`}
          positive={overview.waitlist.newLast7Days > 0}
        />
        <StatCard
          label="Food ideas"
          value={overview.foodIdeas.total}
          sub={`${overview.foodIdeas.active} active · ${overview.foodIdeas.inactive} inactive`}
        />
        <StatCard label="Saved recipes" value={overview.content.recipes} sub="Across all users" />
        <StatCard label="Meal plans" value={overview.content.mealPlans} sub="Across all users" />
      </section>

      <h2 className={styles.sectionHeading}>Sign-up trend</h2>
      <div className={styles.trendCard}>
        <div className={styles.trendHeader}>
          <h3 className={styles.trendTitle}>Last 14 days</h3>
          <div className={styles.trendLegend}>
            <span className={styles.legendItem}>
              <span className={styles.legendDot} style={{ background: 'var(--primary)' }} />
              New users
            </span>
            <span className={styles.legendItem}>
              <span className={styles.legendDot} style={{ background: 'var(--secondary)' }} />
              Waitlist signups
            </span>
          </div>
        </div>
        <TrendChart
          days={overview.trend.days}
          series={[
            { label: 'New users', color: 'var(--primary)', values: overview.trend.users },
            { label: 'Waitlist signups', color: 'var(--secondary)', values: overview.trend.waitlist },
          ]}
        />
      </div>

      <h2 className={styles.sectionHeading}>Manage</h2>
      <div className={styles.quickLinksGrid}>
        <Link href="/admin/users" className={`${styles.placeholderCard} ${styles.cardLink}`}>
          <h2>Users</h2>
          <p className={styles.subtext}>Search accounts, view activity, suspend/reactivate, or delete on request.</p>
        </Link>

        <Link href="/admin/waitlist" className={`${styles.placeholderCard} ${styles.cardLink}`}>
          <h2>Waitlist</h2>
          <p className={styles.subtext}>Pre-launch email signups from the landing page.</p>
        </Link>

        <Link href="/admin/food-ideas" className={`${styles.placeholderCard} ${styles.cardLink}`}>
          <h2>Food ideas</h2>
          <p className={styles.subtext}>Manage Eat Now&apos;s catalog — add, edit, deactivate, or remove dishes.</p>
        </Link>

        <section className={styles.placeholderCard}>
          <h2>Coming next</h2>
          <p className={styles.subtext}>
            Safety events, feedback triage and subscription lookups from docs/ANALYTICS_PLAN.md — once the
            corresponding admin API endpoints exist on the NestJS backend.
          </p>
        </section>
      </div>
    </main>
  );
}

function StatCard({
  label,
  value,
  sub,
  positive,
}: {
  label: string;
  value: number;
  sub: string;
  positive?: boolean;
}) {
  return (
    <div className={styles.statCard}>
      <p className={styles.statLabel}>{label}</p>
      <p className={styles.statValue}>{value.toLocaleString('en-GB')}</p>
      <p className={`${styles.statSub} ${positive ? styles.statSubPositive : ''}`}>{sub}</p>
    </div>
  );
}
