import type { SavedRecipeView } from '@foodpadi/shared';
import { requireSession, serverFetch } from '../../../lib/serverApi';
import { SavedRecipesList } from './SavedRecipesList';
import { BackLink } from '../../../components/BackLink';
import { Logo } from '../../../components/Logo';
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
      <Logo href="/" size={32} className={shellStyles.pageLogo} />
      <BackLink href="/cook-today" label="Cook Today" />
      <h1 className={styles.title}>Saved recipes</h1>
      <SavedRecipesList initialRecipes={recipes} />
    </main>
  );
}
