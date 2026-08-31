import { adminServerFetch, requireAdminSession } from '../../../lib/adminApi';
import { UsersTable } from './UsersTable';
import type { AdminUserListResponse } from './types';
import styles from '../admin.module.css';
import listStyles from './users.module.css';

export const metadata = { title: 'Users — FoodPadi admin' };

export default async function AdminUsersPage() {
  requireAdminSession();
  const initial = await adminServerFetch<AdminUserListResponse>('/admin/users');

  return (
    <main className={listStyles.pageMain}>
      <h1 className={styles.heading}>Users</h1>
      <UsersTable initial={initial} />
    </main>
  );
}
