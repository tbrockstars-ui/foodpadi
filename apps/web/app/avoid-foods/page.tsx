import { requireSession } from '../../lib/serverApi';
import { AvoidFoodsForm } from './AvoidFoodsForm';
import { Logo } from '../../components/Logo';
import shellStyles from '../app-shell.module.css';

/**
 * Onboarding step after /preferences — the customer's "Foods I choose to
 * avoid" list. Web counterpart of the Profile "Foods I choose to avoid"
 * section, shown once during onboarding so FoodPadi has it from day one.
 */
export default async function AvoidFoodsPage() {
  requireSession('/avoid-foods');

  return (
    <main className={shellStyles.container}>
      <Logo href="/" size={38} className={shellStyles.pageLogo} />
      <AvoidFoodsForm />
    </main>
  );
}
