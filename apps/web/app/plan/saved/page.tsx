import type { MealPlanView } from '@foodpadi/shared';
import { requireSession, serverFetch } from '../../../lib/serverApi';
import { SavedPlansList } from './SavedPlansList';
import { BackLink } from '../../../components/BackLink';
import { Logo } from '../../../components/Logo';
import shellStyles from '../../app-shell.module.css';
import styles from '../plan.module.css';

/**
 * Every meal plan the user has generated (auto-saved), like Cook Today's
 * Saved recipes. Mobile counterpart: apps/mobile/src/screens/SavedPlansScreen.tsx.
 */
export default async function SavedPlansPage() {
  requireSession('/plan/saved');
  const plans = await serverFetch<MealPlanView[]>('/plan-ahead');

  return (
    <main className={shellStyles.container}>
      <Logo href="/" size={32} className={shellStyles.pageLogo} />
      <BackLink href="/plan" label="Plan ahead" />
      <h1 className={styles.title}>Saved plans</h1>
      <SavedPlansList initialPlans={plans} />
    </main>
  );
}
