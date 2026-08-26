import { requireSession } from '../../lib/serverApi';
import { PreferencesForm } from './PreferencesForm';
import shellStyles from '../app-shell.module.css';

/** Web counterpart to apps/mobile/src/screens/PreferencesScreen.tsx. */
export default async function PreferencesPage() {
  requireSession('/preferences');

  return (
    <main className={shellStyles.container}>
      <PreferencesForm />
    </main>
  );
}
