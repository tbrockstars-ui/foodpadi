import { requireSession } from '../../lib/serverApi';
import { CookTodayForm } from './CookTodayForm';
import { BackLink } from '../../components/BackLink';
import shellStyles from '../app-shell.module.css';

/** Web counterpart to apps/mobile/src/screens/CookTodayScreen.tsx. */
export default async function CookTodayPage() {
  requireSession('/cook-today');

  return (
    <main className={shellStyles.container}>
      <BackLink href="/" label="Home" />
      <CookTodayForm />
    </main>
  );
}
