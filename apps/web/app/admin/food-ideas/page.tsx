import { adminServerFetch, requireAdminSession } from '../../../lib/adminApi';
import { FoodIdeasTable } from './FoodIdeasTable';
import type { AdminFoodIdeaListResponse } from './types';
import styles from '../admin.module.css';
import listStyles from './food-ideas.module.css';

export const metadata = { title: 'Food ideas — FoodPadi admin' };

/**
 * Eat Now's catalog (docs/IMPLEMENTATION_PLAN.md Phase 4) used to be a
 * hardcoded array requiring a code deploy to change a single dish — this is
 * the admin surface for the DB table that replaced it.
 */
export default async function AdminFoodIdeasPage() {
  requireAdminSession();
  const initial = await adminServerFetch<AdminFoodIdeaListResponse>('/admin/food-ideas?pageSize=25');

  return (
    <main className={listStyles.pageMain}>
      <h1 className={styles.heading}>Food ideas</h1>
      <FoodIdeasTable initial={initial} />
    </main>
  );
}
