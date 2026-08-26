import { requireSession } from '../../lib/serverApi';
import { DisclaimerAcknowledgeForm } from './DisclaimerAcknowledgeForm';
import shellStyles from '../app-shell.module.css';

/** Web counterpart to apps/mobile/src/screens/DisclaimerScreen.tsx. */
export default async function DisclaimerPage() {
  requireSession('/disclaimer');

  return (
    <main className={shellStyles.container}>
      <DisclaimerAcknowledgeForm />
    </main>
  );
}
