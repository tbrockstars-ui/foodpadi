'use client';

import { useEffect, useState } from 'react';
import type { DealerProfileView, DealerView } from '@foodpadi/shared';
import { dealerApi } from '../../../lib/dealerClient';
import {
  BusinessFields,
  ContactFields,
  TaxonomyFields,
  businessUpdatePayload,
  draftFromDealer,
  type BusinessDraft,
} from '../DealerForms';
import { CustomerPreview } from '../CustomerPreview';
import { ResubmitBanner } from './ResubmitBanner';
import { Panel, PageHeader, ScoreRing, StatusBadge } from './ui';
import styles from '../dealers.module.css';

export function ProfileEditor({ initialDealer }: { initialDealer: DealerView }) {
  const [dealer, setDealer] = useState(initialDealer);
  const [draft, setDraft] = useState<BusinessDraft>(draftFromDealer(initialDealer));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [preview, setPreview] = useState<DealerProfileView | null>(null);
  const set = (patch: Partial<BusinessDraft>) => setDraft((d) => ({ ...d, ...patch }));

  useEffect(() => {
    dealerApi.preview().then(setPreview).catch(() => undefined);
  }, []);

  const save = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const updated = await dealerApi.update(businessUpdatePayload(draft));
      setDealer(updated);
      setDraft(draftFromDealer(updated));
      setMsg({ ok: true, text: 'Saved. Your search listing has been updated.' });
      dealerApi.preview().then(setPreview).catch(() => undefined);
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : 'Could not save.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Profile"
        description="Your business identity, contact details and hours — everything here feeds FoodPadi search."
        actions={<ScoreRing pct={dealer.profileCompleteness} />}
      />

      {dealer.listingStatus === 'rejected' || dealer.listingStatus === 'changes_requested' ? (
        <Panel>
          <div className={styles.panelHeader}>
            <p className={styles.panelTitle}>
              {dealer.listingStatus === 'rejected' ? 'Application not approved' : 'Action required'}
            </p>
            <StatusBadge tone={dealer.listingStatus === 'rejected' ? 'red' : 'amber'}>
              {dealer.listingStatus === 'rejected' ? 'Rejected' : 'Changes requested'}
            </StatusBadge>
          </div>
          <p className={styles.itemMeta}>
            {dealer.listingStatus === 'rejected'
              ? "Once you've corrected the issue below, resend your application — it goes back into the same review queue as a fresh application."
              : 'FoodPadi asked for a few updates before this can be approved. Once you’ve made them below, resend for review.'}
          </p>
          <ResubmitBanner
            note={dealer.approvalNote}
            rejected={dealer.listingStatus === 'rejected'}
            onResubmitted={() =>
              setDealer((d) => ({ ...d, listingStatus: 'pending_review', approvalNote: null }))
            }
          />
        </Panel>
      ) : null}

      <div className={styles.profileLayout}>
        <div>
          <Panel title="Business identity" subtitle="What customers see at the top of your profile.">
            <BusinessFields draft={draft} set={set} />
          </Panel>
          <Panel title="What you sell" subtitle="Drives matching in FoodPadi search.">
            <TaxonomyFields draft={draft} set={set} />
          </Panel>
          <Panel title="Contact & hours" subtitle="Only the channels you fill in are ever shown.">
            <ContactFields draft={draft} set={set} />
          </Panel>

          <div className={styles.rowActions}>
            <button className={styles.ctaPrimary} onClick={save} disabled={busy}>
              {busy ? 'Saving…' : 'Save changes'}
            </button>
          </div>
          {msg ? <p className={msg.ok ? styles.success : styles.error}>{msg.text}</p> : null}
        </div>

        <div className={styles.previewSticky}>
          <p className={styles.previewEyebrow}>How customers see you on FoodPadi</p>
          {preview ? (
            <CustomerPreview profile={preview} sponsored={dealer.featuredEligible} />
          ) : (
            <div className={styles.previewCard}>
              <p className={styles.itemMeta}>Loading preview…</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
