import { requireSession } from '../../lib/serverApi';
import { GoalForm } from './GoalForm';
import { Logo } from '../../components/Logo';
import shellStyles from '../app-shell.module.css';

/** Web counterpart to apps/mobile/src/screens/GoalScreen.tsx. */
export default async function GoalPage() {
  requireSession('/goal');

  return (
    <main className={shellStyles.container}>
      <Logo href="/" size={32} className={shellStyles.pageLogo} />
      <GoalForm />
    </main>
  );
}
