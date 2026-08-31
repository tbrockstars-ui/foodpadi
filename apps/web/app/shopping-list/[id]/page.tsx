import type { ShoppingListView } from '@foodpadi/shared';
import { requireSession, serverFetch } from '../../../lib/serverApi';
import { ShoppingListClient } from './ShoppingListClient';
import { BackLink } from '../../../components/BackLink';
import { Logo } from '../../../components/Logo';
import shellStyles from '../../app-shell.module.css';

export default async function ShoppingListPage({ params }: { params: { id: string } }) {
  requireSession(`/shopping-list/${params.id}`);
  const list = await serverFetch<ShoppingListView>(`/plan-ahead/shopping-lists/${params.id}`);

  return (
    <main className={shellStyles.container}>
      <Logo href="/" size={32} className={shellStyles.pageLogo} />
      <BackLink href="/" label="Home" />
      <ShoppingListClient initialList={list} />
    </main>
  );
}
