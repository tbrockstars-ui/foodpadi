import { loadOwnDealerOrOnboard } from '../dealerServer';
import { LocationsManager } from '../LocationsManager';

export const dynamic = 'force-dynamic';

export default async function DealerLocationsPage() {
  const dealer = await loadOwnDealerOrOnboard();
  return <LocationsManager initialDealer={dealer} />;
}
