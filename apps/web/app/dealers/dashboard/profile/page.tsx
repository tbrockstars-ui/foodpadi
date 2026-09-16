import { loadOwnDealerOrOnboard } from '../dealerServer';
import { ProfileEditor } from '../ProfileEditor';

export const dynamic = 'force-dynamic';

export default async function DealerProfilePage() {
  const dealer = await loadOwnDealerOrOnboard();
  return <ProfileEditor initialDealer={dealer} />;
}
