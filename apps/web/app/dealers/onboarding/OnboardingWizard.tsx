'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { DealerProfileView, DealerView } from '@foodpadi/shared';
import { dealerApi } from '../../../lib/dealerClient';
import {
  BusinessFields,
  ContactFields,
  LocationsEditor,
  ProductsEditor,
  TaxonomyFields,
  businessUpdatePayload,
  draftFromDealer,
  type BusinessDraft,
} from '../DealerForms';
import { CustomerPreview } from '../CustomerPreview';
import styles from '../dealers.module.css';

// No "Subscribe" step — FoodPadi reviews every application before a dealer is
// ever offered payment (admin-approval-before-payment, 2026-09-11). Preview is
// the final step; "Submit application" hands off to admin review and the
// dealer dashboard takes over from there (Pending Review → Approved → Subscribe).
const STEPS = ['Business', 'What you sell', 'Where you serve', 'Contact', 'Preview'] as const;

const EMPTY_DRAFT: BusinessDraft = {
  name: '',
  dealerType: 'restaurant',
  description: '',
  categories: [],
  cuisines: [],
  productKeywords: [],
  dietaryTags: [],
  serviceType: [],
  phone: '',
  websiteUrl: '',
  orderUrl: '',
  whatsapp: '',
  openingHours: {},
};

export function OnboardingWizard({ initialDealer }: { initialDealer: DealerView | null }) {
  const router = useRouter();
  const [dealer, setDealer] = useState<DealerView | null>(initialDealer);
  const [draft, setDraft] = useState<BusinessDraft>(
    initialDealer ? draftFromDealer(initialDealer) : EMPTY_DRAFT,
  );
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<DealerProfileView | null>(null);

  const set = (patch: Partial<BusinessDraft>) => setDraft((d) => ({ ...d, ...patch }));

  const canContact = useMemo(
    () => Boolean(draft.phone.trim() || draft.websiteUrl.trim() || draft.orderUrl.trim() || draft.whatsapp.trim()),
    [draft],
  );

  async function persistBusiness(): Promise<DealerView> {
    if (!dealer) {
      await dealerApi.create({ name: draft.name.trim(), dealerType: draft.dealerType });
      const patched = await dealerApi.update(businessUpdatePayload(draft));
      setDealer(patched);
      return patched;
    }
    const patched = await dealerApi.update(businessUpdatePayload(draft));
    setDealer(patched);
    return patched;
  }

  async function next() {
    setError(null);
    setBusy(true);
    try {
      if (step === 0) {
        if (draft.name.trim().length < 2) {
          setError('Enter your business name.');
          return;
        }
        await persistBusiness();
      } else if (step === 1) {
        await persistBusiness(); // taxonomy is part of the business payload
      } else if (step === 3) {
        if (!canContact) {
          setError('Add at least one way for customers to reach you.');
          return;
        }
        await persistBusiness();
      }
      setStep((s) => Math.min(s + 1, STEPS.length - 1));
      if (step + 1 === 4) setPreview(await dealerApi.preview());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  function back() {
    setError(null);
    setStep((s) => Math.max(0, s - 1));
  }

  // FoodPadi reviews every application before a dealer is ever offered
  // payment (admin-approval-before-payment, 2026-09-11) — this hands off to
  // admin review; there is no checkout here. The dealer dashboard picks up
  // from Pending Review onward and only shows a Subscribe option once
  // approved.
  async function submitApplication() {
    setBusy(true);
    setError(null);
    try {
      await dealerApi.submit();
      router.push('/dealers/dashboard?submitted=1');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not submit your application.');
      setBusy(false);
    }
  }

  const dealerForChildren = dealer;

  return (
    <div className={styles.wrap}>
      <div className={styles.content} style={{ margin: '0 auto' }}>
        <div className={styles.steps} aria-hidden>
          {STEPS.map((_, i) => (
            <span key={i} className={`${styles.stepDot} ${i <= step ? styles.stepDotDone : ''}`} />
          ))}
        </div>
        <p className={styles.itemMeta}>
          Step {step + 1} of {STEPS.length}
        </p>

        {step === 0 && (
          <>
            <h1 className={styles.stepHeading}>Tell us about your business</h1>
            <p className={styles.stepSub}>This is what customers will see at the top of your profile.</p>
            <BusinessFields draft={draft} set={set} />
          </>
        )}

        {step === 1 && (
          <>
            <h1 className={styles.stepHeading}>What do you sell?</h1>
            <p className={styles.stepSub}>
              These drive FoodPadi search — a customer searching &ldquo;egusi Leicester&rdquo; should be
              able to find you when it genuinely matches.
            </p>
            <TaxonomyFields draft={draft} set={set} />
            {dealerForChildren ? (
              <>
                <h2 className={styles.cardTitle} style={{ marginTop: 'var(--space-lg)' }}>
                  Products
                </h2>
                <ProductsEditor
                  products={dealerForChildren.products}
                  onChange={(d) => {
                    setDealer(d);
                  }}
                />
              </>
            ) : (
              <p className={styles.itemMeta}>Save this step to start adding products.</p>
            )}
          </>
        )}

        {step === 2 && (
          <>
            <h1 className={styles.stepHeading}>Where do you serve customers?</h1>
            <p className={styles.stepSub}>
              Add your shop location, or the areas a distributor covers. Only claim places you
              actually serve.
            </p>
            {dealerForChildren ? (
              <LocationsEditor
                locations={dealerForChildren.locations}
                onChange={(d) => setDealer(d)}
              />
            ) : (
              <p className={styles.itemMeta}>Save the earlier steps first.</p>
            )}
          </>
        )}

        {step === 3 && (
          <>
            <h1 className={styles.stepHeading}>How can customers reach you?</h1>
            <p className={styles.stepSub}>FoodPadi links customers to your existing channels.</p>
            <ContactFields draft={draft} set={set} />
          </>
        )}

        {step === 4 && (
          <>
            <h1 className={styles.stepHeading}>This is how customers will see you</h1>
            <p className={styles.stepSub}>
              Review your listing, then submit it for review. FoodPadi checks every application
              before a dealer is ever offered a subscription — you do not need to pay anything at
              this stage.
            </p>
            {preview ? <CustomerPreview profile={preview} sponsored={false} /> : <p className={styles.itemMeta}>Loading preview…</p>}
          </>
        )}

        {error ? <p className={styles.error}>{error}</p> : null}

        <div className={styles.wizardNav}>
          <button className={styles.ctaSecondary} onClick={back} disabled={busy || step === 0}>
            Back
          </button>
          {step === 4 ? (
            <button className={styles.ctaPrimary} onClick={submitApplication} disabled={busy}>
              {busy ? 'Submitting…' : 'Submit application for review'}
            </button>
          ) : (
            <button className={styles.ctaPrimary} onClick={next} disabled={busy}>
              {busy ? 'Saving…' : 'Save & continue'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
