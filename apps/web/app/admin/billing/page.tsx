import Link from 'next/link';
import type { BillingConfigView, FxRatesView } from '@foodpadi/shared';
import { adminServerFetch, requireAdminSession } from '../../../lib/adminApi';
import { BillingConfigForm } from './BillingConfigForm';
import { FxRatesPanel } from './FxRatesPanel';
import styles from '../admin.module.css';
import listStyles from '../food-ideas/food-ideas.module.css';

export const metadata = { title: 'Subscription — FoodPadi admin' };

export default async function AdminBillingPage() {
  requireAdminSession();
  const [config, fx] = await Promise.all([
    adminServerFetch<BillingConfigView>('/admin/billing/config'),
    adminServerFetch<FxRatesView>('/admin/billing/fx').catch(() => null),
  ]);

  return (
    <main className={listStyles.pageMain}>
      <div className={styles.dashboardHeader}>
        <h1 className={styles.heading}>Subscription</h1>
        <Link href="/admin" className={styles.linkButton}>
          ‹ Overview
        </Link>
      </div>
      <p className={styles.subtext}>
        The live parameters for FoodPadi Premium. Saving pushes price changes to Stripe and
        Flutterwave automatically (their price objects are immutable, so a base-price change mints a
        new one). Existing subscribers keep the price they signed up at.
      </p>
      <BillingConfigForm initial={config} />
      {fx ? <FxRatesPanel initial={fx} /> : null}
    </main>
  );
}
