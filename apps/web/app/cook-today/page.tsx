import Link from 'next/link';
import { requireSession } from '../../lib/serverApi';
import { CookTodayForm } from './CookTodayForm';
import shellStyles from '../app-shell.module.css';

/** Web counterpart to apps/mobile/src/screens/CookTodayScreen.tsx. */
export default async function CookTodayPage() {
  requireSession('/cook-today');

  return (
    <main className={shellStyles.container}>
      <Link href="/" className={shellStyles.backLink}>
        ‹ Home
      </Link>
      <CookTodayForm />
    </main>
  );
}
