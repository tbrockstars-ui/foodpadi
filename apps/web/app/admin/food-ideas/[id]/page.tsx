import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ApiError, adminServerFetch, requireAdminSession } from '../../../../lib/adminApi';
import { FoodIdeaForm } from '../FoodIdeaForm';
import type { AdminFoodIdea } from '../types';
import styles from '../../admin.module.css';
import listStyles from '../food-ideas.module.css';

export const metadata = { title: 'Edit food idea — FoodPadi admin' };

export default async function EditFoodIdeaPage({ params }: { params: { id: string } }) {
  requireAdminSession();

  let foodIdea: AdminFoodIdea;
  try {
    foodIdea = await adminServerFetch<AdminFoodIdea>(`/admin/food-ideas/${params.id}`);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  }

  return (
    <main className={listStyles.pageMain}>
      <div className={styles.dashboardHeader}>
        <h1 className={styles.heading}>Edit food idea</h1>
        <Link href="/admin/food-ideas" className={styles.linkButton}>
          ‹ Food ideas
        </Link>
      </div>
      <FoodIdeaForm mode="edit" initial={foodIdea} />
    </main>
  );
}
