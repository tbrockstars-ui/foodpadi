import Link from 'next/link';
import type { SavedRecipeView } from '@foodpadi/shared';
import { redirectToLoginIfUnauthorized, requireSession, serverFetch } from '../../lib/serverApi';
import { FavoritesList } from './FavoritesList';
import { AppShell } from '../../components/AppShell';
import shellStyles from '../app-shell.module.css';
import styles from '../cook-today/cook-today.module.css';

/**
 * Favorites engine, read view — recipes with the heart on OR a 5-star COOK
 * rating (CookTodayService.listFavorites). Distinct from "Saved recipes"
 * (/cook-today/saved), which is everything ever saved/cooked regardless of
 * how it was received.
 */
export default async function FavoritesPage() {
  requireSession('/favorites');

  let favorites: SavedRecipeView[] | null = null;
  try {
    favorites = await serverFetch<SavedRecipeView[]>('/cook-today/recipes/favorites');
  } catch (e) {
    // Stale session (access token expired) — re-auth via login rather than
    // dead-ending on the "couldn't load" error below.
    redirectToLoginIfUnauthorized(e, '/favorites');
    // Any other error (API unreachable) — fall through to the "couldn't
    // load" state below rather than taking down the whole route (same
    // precedent as /invite).
  }

  return (
    <AppShell guest={false}>
      <main className={shellStyles.shellPage}>
        <h1 className={styles.title}>Favorites</h1>
        <p className={styles.subtitle}>Recipes you&apos;ve loved — hearted, or rated 5 stars after cooking.</p>
        {favorites ? (
          <FavoritesList initialFavorites={favorites} />
        ) : (
          <>
            <p className={styles.errorText}>Couldn&apos;t load your favorites. Check your connection and try again.</p>
            <Link href="/favorites" className={styles.primaryButton} style={{ textDecoration: 'none', display: 'inline-block' }}>
              Try again
            </Link>
          </>
        )}
      </main>
    </AppShell>
  );
}
