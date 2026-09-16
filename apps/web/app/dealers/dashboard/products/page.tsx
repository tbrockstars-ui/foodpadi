import { loadOwnDealerOrOnboard } from '../dealerServer';
import { ProductsManager } from '../ProductsManager';

export const dynamic = 'force-dynamic';

export default async function DealerProductsPage() {
  const dealer = await loadOwnDealerOrOnboard();
  return <ProductsManager initialDealer={dealer} />;
}
