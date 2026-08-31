import { adminServerFetch, requireAdminSession } from '../../../lib/adminApi';
import { WaitlistTable } from './WaitlistTable';
import type { AdminWaitlistListResponse } from './types';
import styles from '../admin.module.css';
import listStyles from './waitlist.module.css';

export const metadata = { title: 'Waitlist — FoodPadi admin' };

export default async function AdminWaitlistPage() {
  requireAdminSession();
  const initial = await adminServerFetch<AdminWaitlistListResponse>('/admin/waitlist');

  return (
    <main className={listStyles.pageMain}>
      <h1 className={styles.heading}>Waitlist</h1>
      <WaitlistTable initial={initial} />
    </main>
  );
}
