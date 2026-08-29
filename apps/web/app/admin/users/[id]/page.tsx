import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ApiError, adminServerFetch, requireAdminSession } from '../../../../lib/adminApi';
import { UserDetailActions } from './UserDetailActions';
import type { AdminUserDetail } from '../types';
import styles from '../../admin.module.css';
import listStyles from '../users.module.css';

export const metadata = { title: 'User — FoodPadi admin' };

export default async function AdminUserDetailPage({ params }: { params: { id: string } }) {
  requireAdminSession();

  let user: AdminUserDetail;
  try {
    user = await adminServerFetch<AdminUserDetail>(`/admin/users/${params.id}`);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  }

  return (
    <main className={listStyles.pageMain}>
      <div className={styles.dashboardHeader}>
        <h1 className={styles.heading}>{user.email}</h1>
        <Link href="/admin/users" className={styles.linkButton}>
          ‹ All users
        </Link>
      </div>

      <div className={listStyles.detailCard}>
        <div className={listStyles.detailRow}>
          <span className={listStyles.detailLabel}>Status</span>
          <span className={`${listStyles.badge} ${user.suspended ? listStyles.badgeSuspended : listStyles.badgeActive}`}>
            {user.suspended ? 'Suspended' : 'Active'}
          </span>
        </div>
        <div className={listStyles.detailRow}>
          <span className={listStyles.detailLabel}>Display name</span>
          <span>{user.displayName ?? '—'}</span>
        </div>
        <div className={listStyles.detailRow}>
          <span className={listStyles.detailLabel}>Joined</span>
          <span>{new Date(user.createdAt).toLocaleString('en-GB')}</span>
        </div>
        <div className={listStyles.detailRow}>
          <span className={listStyles.detailLabel}>Disclaimer acknowledged</span>
          <span>{user.disclaimerAcknowledgedAt ? new Date(user.disclaimerAcknowledgedAt).toLocaleString('en-GB') : '—'}</span>
        </div>
        <div className={listStyles.detailRow}>
          <span className={listStyles.detailLabel}>Onboarding completed</span>
          <span>{user.onboardingCompletedAt ? new Date(user.onboardingCompletedAt).toLocaleString('en-GB') : '—'}</span>
        </div>
        <div className={listStyles.detailRow}>
          <span className={listStyles.detailLabel}>Auth provider</span>
          <span>{user.authProvider}</span>
        </div>
      </div>

      <div className={listStyles.detailCard}>
        <h2 className={listStyles.cardHeading}>
          Activity
        </h2>
        <div className={listStyles.detailRow}>
          <span className={listStyles.detailLabel}>Saved recipes</span>
          <span>{user.counts.recipes}</span>
        </div>
        <div className={listStyles.detailRow}>
          <span className={listStyles.detailLabel}>Meal plans</span>
          <span>{user.counts.mealPlans}</span>
        </div>
        <div className={listStyles.detailRow}>
          <span className={listStyles.detailLabel}>Pantry items</span>
          <span>{user.counts.pantryItems}</span>
        </div>
        <div className={listStyles.detailRow}>
          <span className={listStyles.detailLabel}>Shopping lists</span>
          <span>{user.counts.shoppingLists}</span>
        </div>
      </div>

      <div className={listStyles.detailCard}>
        <h2 className={listStyles.cardHeading}>
          Food goals
        </h2>
        {user.goals.length === 0 ? (
          <p className={styles.subtext}>None set.</p>
        ) : (
          <div className={listStyles.chipList}>
            {user.goals.map((g) => (
              <span key={g.id} className={listStyles.chip}>
                {g.goalType}
                {g.isPrimary ? ' (primary)' : ''}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className={listStyles.detailCard}>
        <h2 className={listStyles.cardHeading}>
          Favourite cuisines
        </h2>
        {user.preferences.filter((p) => p.cuisine).length === 0 ? (
          <p className={styles.subtext}>None set.</p>
        ) : (
          <div className={listStyles.chipList}>
            {user.preferences
              .filter((p) => p.cuisine)
              .map((p) => (
                <span key={p.id} className={listStyles.chip}>
                  {p.cuisine}
                </span>
              ))}
          </div>
        )}
      </div>

      <div className={listStyles.detailCard}>
        <h2 className={listStyles.cardHeading}>
          Avoided ingredients
        </h2>
        {user.avoidedIngredients.length === 0 ? (
          <p className={styles.subtext}>None set.</p>
        ) : (
          <div className={listStyles.chipList}>
            {user.avoidedIngredients.map((a) => (
              <span key={a.id} className={listStyles.chip}>
                {a.ingredientName}
              </span>
            ))}
          </div>
        )}
      </div>

      <UserDetailActions userId={user.id} suspended={user.suspended} />
    </main>
  );
}
