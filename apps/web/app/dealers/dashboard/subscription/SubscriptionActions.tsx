'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { DealerSubscriptionView } from '@foodpadi/shared';
import { dealerApi } from '../../../../lib/dealerClient';
import styles from '../../dealers.module.css';

export function SubscriptionActions({ initial }: { initial: DealerSubscriptionView }) {
  const [sub, setSub] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const router = useRouter();

  const subscribe = async (provider?: 'stripe' | 'flutterwave') => {
    setBusy(true);
    setMsg(null);
    try {
      const { url } = await dealerApi.checkout(provider);
      // `url` is relative in demo mode (stays on this origin) and absolute for a
      // real provider-hosted checkout — both are fine for a full-page nav.
      window.location.href = url;
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Could not start checkout.');
      setBusy(false);
    }
  };

  const manage = async () => {
    setBusy(true);
    try {
      const { url } = await dealerApi.portalLink();
      window.location.href = url;
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Could not open the billing portal.');
      setBusy(false);
    }
  };

  const cancel = async () => {
    if (!confirm('Cancel your Food Dealer subscription? Your listing stays live until the end of the paid period, then is removed from FoodPadi search.')) {
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      setSub(await dealerApi.cancel());
      setMsg('Cancellation scheduled for the end of your current period.');
      router.refresh();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Could not cancel.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={styles.rowActions}>
      {!sub.active ? (
        <>
          <button className={styles.ctaPrimary} onClick={() => subscribe()} disabled={busy}>
            {busy ? 'Starting…' : 'Subscribe'}
          </button>
          <button
            className={styles.ctaSecondary}
            onClick={() => subscribe('flutterwave')}
            disabled={busy}
          >
            Pay in ₦ (Nigeria)
          </button>
        </>
      ) : null}
      {sub.canManage ? (
        <button className={styles.ctaSecondary} onClick={manage} disabled={busy}>
          Manage billing
        </button>
      ) : null}
      {sub.canCancel ? (
        <button className={styles.ctaSecondary} onClick={cancel} disabled={busy}>
          Cancel subscription
        </button>
      ) : null}
      {msg ? <p className={styles.itemMeta} style={{ width: '100%' }}>{msg}</p> : null}
    </div>
  );
}
