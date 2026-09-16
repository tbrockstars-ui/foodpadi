import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { AdminDealerDetail } from '@foodpadi/shared';
import { ApiError, adminServerFetch, requireAdminSession } from '../../../../lib/adminApi';
import { DealerAdminPanel } from './DealerAdminPanel';
import styles from '../../admin.module.css';

export const metadata = { title: 'Dealer — FoodPadi admin' };
export const dynamic = 'force-dynamic';

export default async function AdminDealerDetailPage({ params }: { params: { id: string } }) {
  requireAdminSession();
  let dealer: AdminDealerDetail;
  try {
    dealer = await adminServerFetch<AdminDealerDetail>(`/admin/dealers/${params.id}`);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  }

  return (
    <main className={styles.pageMain}>
      <p style={{ marginBottom: 8 }}>
        <Link href="/admin/dealers">← All dealers</Link>
      </p>
      <h1 className={styles.heading}>{dealer.name}</h1>
      <DealerAdminPanel initial={dealer} />
    </main>
  );
}
