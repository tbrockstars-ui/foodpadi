import type { AdminDealerListResponse, AdminDealerOverview } from '@foodpadi/shared';
import { adminServerFetch, requireAdminSession } from '../../../lib/adminApi';
import { DealersTable } from './DealersTable';
import styles from '../admin.module.css';
import dealerStyles from './dealers-admin.module.css';

export const metadata = { title: 'Food Dealers — FoodPadi admin' };
export const dynamic = 'force-dynamic';

const TILES: { key: keyof AdminDealerOverview; label: string }[] = [
  { key: 'pendingReview', label: 'Pending review' },
  { key: 'changesRequested', label: 'Changes requested' },
  { key: 'approvedUnpaid', label: 'Approved / unpaid' },
  { key: 'active', label: 'Active dealers' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'suspended', label: 'Suspended' },
];

export default async function AdminDealersPage() {
  requireAdminSession();
  const [initial, overview] = await Promise.all([
    adminServerFetch<AdminDealerListResponse>('/admin/dealers'),
    adminServerFetch<AdminDealerOverview>('/admin/dealers/overview'),
  ]);
  return (
    <main className={styles.pageMain}>
      <h1 className={styles.heading}>Food Dealers</h1>
      <div className={dealerStyles.overviewStrip}>
        {TILES.map((t) => (
          <div className={dealerStyles.overviewTile} key={t.key}>
            <div className={dealerStyles.overviewValue}>{overview[t.key]}</div>
            <div className={dealerStyles.overviewLabel}>{t.label}</div>
          </div>
        ))}
      </div>
      <DealersTable initial={initial} />
    </main>
  );
}
