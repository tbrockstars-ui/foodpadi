import Link from 'next/link';
import type { SavedRecipeView } from '@foodpadi/shared';
import { requireSession, serverFetch } from '../../../lib/serverApi';
import { SavedRecipesList } from './SavedRecipesList';
import { AppShell } from '../../../components/AppShell';
import shellStyles from '../../app-shell.module.css';
import styles from '../cook-today.module.css';

/**
 * Cook Today's save button (and recipe-import) have written to
 * `GET /cook-today/recipes` since Phase 2, but nothing ever read it back —
 * this is that missing viewer. Mobile counterpart: SavedRecipesScreen.tsx.
 */
export default async function SavedRecipesPage() {
  requireSession('/cook-today/saved');

  let recipes: SavedRecipeView[] | null = null;
  try {
    recipes = await serverFetch<SavedRecipeView[]>('/cook-today/recipes');
  } catch {
    // API unreachable — fall through to the "couldn't load" state below
    // rather than taking down the whole route (same precedent as /invite).
  }

  return (
    <AppShell guest={false}>
      <main className={shellStyles.shellPage}>
        <h1 className={styles.title}>Saved recipes</h1>
        {recipes ? (
          <SavedRecipesList initialRecipes={recipes} />
        ) : (
          <>
            <p className={styles.errorText}>Couldn&apos;t load your saved recipes. Check your connection and try again.</p>
            <Link href="/cook-today/saved" className={styles.primaryButton} style={{ textDecoration: 'none', display: 'inline-block' }}>
              Try again
            </Link>
          </>
        )}
      </main>
    </AppShell>
  );
}
