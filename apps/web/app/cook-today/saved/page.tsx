import Link from 'next/link';
import type { SavedRecipeView } from '@foodpadi/shared';
import { requireSession, serverFetch } from '../../../lib/serverApi';
import { SavedRecipesList } from './SavedRecipesList';
import shellStyles from '../../app-shell.module.css';
import styles from '../cook-today.module.css';

/**
 * Cook Today's save button (and recipe-import) have written to
 * `GET /cook-today/recipes` since Phase 2, but nothing ever read it back —
 * this is that missing viewer. Mobile counterpart: SavedRecipesScreen.tsx.
 */
export default async function SavedRecipesPage() {
  requireSession('/cook-today/saved');
  const recipes = await serverFetch<SavedRecipeView[]>('/cook-today/recipes');

  return (
    <main className={shellStyles.container}>
      <Link href="/cook-today" className={shellStyles.backLink}>
        ‹ Cook Today
      </Link>
      <h1 className={styles.title}>Saved recipes</h1>
      <SavedRecipesList initialRecipes={recipes} />
    </main>
  );
}
