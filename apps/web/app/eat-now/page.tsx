import { requireSession } from '../../lib/serverApi';
import { EatNowSearchForm } from './EatNowSearchForm';
import { BackLink } from '../../components/BackLink';
import shellStyles from '../app-shell.module.css';

/** Web counterpart to apps/mobile/src/screens/EatNowScreen.tsx. */
export default async function EatNowPage() {
  requireSession('/eat-now');

  return (
    <main className={shellStyles.container}>
      <BackLink href="/" label="Home" />
      <EatNowSearchForm />
    </main>
  );
}
