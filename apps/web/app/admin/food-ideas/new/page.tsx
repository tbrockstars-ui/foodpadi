import Link from 'next/link';
import { requireAdminSession } from '../../../../lib/adminApi';
import { FoodIdeaForm } from '../FoodIdeaForm';
import styles from '../../admin.module.css';
import listStyles from '../food-ideas.module.css';

export const metadata = { title: 'Add food idea — FoodPadi admin' };

export default function NewFoodIdeaPage() {
  requireAdminSession();

  return (
    <main className={listStyles.pageMain}>
      <div className={styles.dashboardHeader}>
        <h1 className={styles.heading}>Add food idea</h1>
        <Link href="/admin/food-ideas" className={styles.linkButton}>
          ‹ Food ideas
        </Link>
      </div>
      <FoodIdeaForm mode="create" />
    </main>
  );
}
