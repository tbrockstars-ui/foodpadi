import Link from 'next/link';
import type { ShoppingListView } from '@foodpadi/shared';
import { requireSession, serverFetch } from '../../../lib/serverApi';
import { ShoppingListClient } from './ShoppingListClient';
import { AppShell } from '../../../components/AppShell';
import shellStyles from '../../app-shell.module.css';
import styles from '../shopping-list.module.css';

export default async function ShoppingListPage({ params }: { params: { id: string } }) {
  requireSession(`/shopping-list/${params.id}`);

  let list: ShoppingListView | null = null;
  try {
    list = await serverFetch<ShoppingListView>(`/plan-ahead/shopping-lists/${params.id}`);
  } catch {
    // API unreachable — fall through to the "couldn't load" state below
    // rather than taking down the whole route (same precedent as /invite).
  }

  return (
    <AppShell guest={false}>
      <main className={shellStyles.shellPage}>
        {list ? (
          <ShoppingListClient initialList={list} />
        ) : (
          <>
            <p className={styles.errorText}>Couldn&apos;t load this shopping list. Check your connection and try again.</p>
            <Link href={`/shopping-list/${params.id}`} className={styles.retryLink}>
              Try again
            </Link>
          </>
        )}
      </main>
    </AppShell>
  );
}
