'use client';

import { useEffect, useState } from 'react';
import type { DealerLocationInput, DealerOwnerLocationView, DealerView } from '@foodpadi/shared';
import { dealerApi } from '../../../lib/dealerClient';
import { EmptyState, PageHeader } from './ui';
import styles from '../dealers.module.css';

function toInput(l: DealerOwnerLocationView): DealerLocationInput {
  return {
    label: l.label,
    addressLine: l.addressLine,
    locality: l.locality,
    city: l.city,
    region: l.region,
    postcode: l.postcode,
    countryCode: l.countryCode,
    latitude: l.latitude,
    longitude: l.longitude,
    isPrimary: l.isPrimary,
    serviceAreas: l.serviceAreas,
    serviceRadiusMiles: l.serviceRadiusMiles,
  };
}

const EMPTY_DRAFT: DealerLocationInput = {
  label: '',
  addressLine: '',
  locality: '',
  postcode: '',
  serviceAreas: [],
  isPrimary: false,
};

function LocationModal({
  title,
  initial,
  busy,
  error,
  onCancel,
  onSave,
}: {
  title: string;
  initial: DealerLocationInput;
  busy: boolean;
  error: string | null;
  onCancel: () => void;
  onSave: (input: DealerLocationInput) => void;
}) {
  const [draft, setDraft] = useState<DealerLocationInput>(initial);
  const [serviceAreasText, setServiceAreasText] = useState((initial.serviceAreas ?? []).join(', '));
  const set = (patch: Partial<DealerLocationInput>) => setDraft((d) => ({ ...d, ...patch }));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onCancel]);

  const submit = () => {
    onSave({
      ...draft,
      label: draft.label?.trim() || null,
      addressLine: draft.addressLine?.trim() || null,
      locality: (draft.locality ?? '').trim(),
      postcode: draft.postcode?.trim() || null,
      serviceAreas: serviceAreasText.split(',').map((s) => s.trim()).filter(Boolean),
    });
  };

  return (
    <div className={styles.modalBackdrop} role="dialog" aria-modal="true" onClick={onCancel}>
      <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
        <p className={styles.modalTitle}>{title}</p>
        <p className={styles.modalSub}>Only claim places you actually serve.</p>

        <label className={styles.field}>
          <span className={styles.fieldLabel}>
            Location name <span className={styles.fieldHint}>· optional — e.g. &ldquo;Leicester Branch&rdquo;</span>
          </span>
          <input className={styles.input} value={draft.label ?? ''} onChange={(e) => set({ label: e.target.value })} />
        </label>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>Address</span>
          <input
            className={styles.input}
            placeholder="123 Example Street"
            value={draft.addressLine ?? ''}
            onChange={(e) => set({ addressLine: e.target.value })}
          />
        </label>
        <div className={styles.fieldRow}>
          <label className={styles.field} style={{ marginBottom: 0 }}>
            <span className={styles.fieldLabel}>Town / city</span>
            <input className={styles.input} value={draft.locality ?? ''} onChange={(e) => set({ locality: e.target.value })} />
          </label>
          <label className={styles.field} style={{ marginBottom: 0 }}>
            <span className={styles.fieldLabel}>Postcode</span>
            <input className={styles.input} value={draft.postcode ?? ''} onChange={(e) => set({ postcode: e.target.value })} />
          </label>
        </div>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>
            Also serves <span className={styles.fieldHint}>· comma separated, optional</span>
          </span>
          <input className={styles.input} value={serviceAreasText} onChange={(e) => setServiceAreasText(e.target.value)} />
        </label>
        <div className={styles.switchRow}>
          <span className={styles.fieldLabel} style={{ marginBottom: 0 }}>
            Primary location
          </span>
          <button
            type="button"
            className={`${styles.chip} ${styles.chipToggle} ${draft.isPrimary ? styles.chipToggleOn : ''}`}
            aria-pressed={!!draft.isPrimary}
            onClick={() => set({ isPrimary: !draft.isPrimary })}
          >
            {draft.isPrimary ? 'Primary' : 'Set as primary'}
          </button>
        </div>

        {error ? <p className={styles.error}>{error}</p> : null}

        <div className={styles.modalActions}>
          <button type="button" className={styles.ctaSecondary} onClick={onCancel} disabled={busy}>
            Cancel
          </button>
          <button type="button" className={styles.ctaPrimary} onClick={submit} disabled={busy || !(draft.locality ?? '').trim()}>
            {busy ? 'Saving…' : 'Save location'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function LocationsManager({ initialDealer }: { initialDealer: DealerView }) {
  const [dealer, setDealer] = useState(initialDealer);
  const [modal, setModal] = useState<{ mode: 'add' | 'edit'; location?: DealerOwnerLocationView } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const flash = (text: string) => {
    setToast(text);
    setTimeout(() => setToast((t) => (t === text ? null : t)), 3200);
  };

  const runSave = async (input: DealerLocationInput) => {
    setBusy(true);
    setError(null);
    try {
      const updated =
        modal?.mode === 'edit' && modal.location
          ? await dealerApi.updateLocation(modal.location.id, input)
          : await dealerApi.addLocation(input);
      setDealer(updated);
      setModal(null);
      flash(modal?.mode === 'edit' ? 'Location updated.' : 'Location added.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save that location.');
    } finally {
      setBusy(false);
    }
  };

  const setPrimary = async (l: DealerOwnerLocationView) => {
    setBusy(true);
    try {
      setDealer(await dealerApi.updateLocation(l.id, { ...toInput(l), isPrimary: true }));
      flash('Primary location updated.');
    } catch (e) {
      flash(e instanceof Error ? e.message : 'Could not update.');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (l: DealerOwnerLocationView) => {
    if (!confirm(`Remove ${l.label || l.locality}?`)) return;
    setBusy(true);
    try {
      setDealer(await dealerApi.removeLocation(l.id));
      flash('Location removed.');
    } catch (e) {
      flash(e instanceof Error ? e.message : 'Could not remove that location.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Locations"
        description="Where you serve customers. The first location is your primary one."
        actions={
          <button type="button" className={styles.ctaPrimary} onClick={() => setModal({ mode: 'add' })}>
            + Add location
          </button>
        }
      />

      {dealer.locations.length === 0 ? (
        <EmptyState
          icon="📍"
          title="No locations yet"
          text="Add your shop location, or the areas a distributor covers."
          action={
            <button type="button" className={styles.ctaPrimary} onClick={() => setModal({ mode: 'add' })}>
              Add your first location
            </button>
          }
        />
      ) : (
        <div className={styles.panelGrid2}>
          {dealer.locations.map((l) => (
            <div className={styles.panel} key={l.id} style={{ marginBottom: 0 }}>
              <div className={styles.panelHeader}>
                <div>
                  <p className={styles.panelTitle}>{l.label || l.locality}</p>
                  <p className={styles.panelSub}>{l.addressLine || l.locality}</p>
                </div>
                {l.isPrimary ? <span className={`${styles.badge} ${styles.badgeLime}`}>Primary</span> : null}
              </div>
              <p className={styles.itemMeta} style={{ margin: 0 }}>
                {[l.postcode, l.countryCode].filter(Boolean).join(' · ') || '—'}
              </p>
              {l.serviceAreas.length ? (
                <p className={styles.itemMeta} style={{ margin: '4px 0 0' }}>
                  Also serves: {l.serviceAreas.join(', ')}
                </p>
              ) : null}
              <div className={styles.rowActions}>
                <button type="button" className={styles.ctaSecondary} onClick={() => setModal({ mode: 'edit', location: l })}>
                  Manage
                </button>
                {!l.isPrimary ? (
                  <button type="button" className={styles.ctaSecondary} onClick={() => setPrimary(l)} disabled={busy}>
                    Set primary
                  </button>
                ) : null}
                <button type="button" className={styles.btnDanger} onClick={() => remove(l)} disabled={busy}>
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {modal ? (
        <LocationModal
          title={modal.mode === 'add' ? 'Add location' : 'Manage location'}
          initial={modal.location ? toInput(modal.location) : EMPTY_DRAFT}
          busy={busy}
          error={error}
          onCancel={() => {
            setModal(null);
            setError(null);
          }}
          onSave={runSave}
        />
      ) : null}

      {toast ? (
        <div className={styles.toastWrap}>
          <div className={`${styles.toast} ${styles.toastOk}`}>{toast}</div>
        </div>
      ) : null}
    </>
  );
}
