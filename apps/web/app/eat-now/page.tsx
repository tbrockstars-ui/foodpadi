import Link from 'next/link';
import { requireSession } from '../../lib/serverApi';
import { EatNowSearchForm } from './EatNowSearchForm';
import shellStyles from '../app-shell.module.css';

/** Web counterpart to apps/mobile/src/screens/EatNowScreen.tsx. */
export default async function EatNowPage() {
  requireSession('/eat-now');

  return (
    <main className={shellStyles.container}>
      <Link href="/" className={shellStyles.backLink}>
        ‹ Home
      </Link>
      <EatNowSearchForm />
    </main>
  );
}
