import { requireSession } from '../../lib/serverApi';
import { PreferencesForm } from './PreferencesForm';
import { Logo } from '../../components/Logo';
import shellStyles from '../app-shell.module.css';

/** Web counterpart to apps/mobile/src/screens/PreferencesScreen.tsx. */
export default async function PreferencesPage() {
  requireSession('/preferences');

  return (
    <main className={shellStyles.container}>
      <Logo href="/" size={32} className={shellStyles.pageLogo} />
      <PreferencesForm />
    </main>
  );
}
