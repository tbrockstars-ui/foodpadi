'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { DealerOwnerProductView, DealerProductInput, DealerView } from '@foodpadi/shared';
import { dealerApi } from '../../../lib/dealerClient';
import { EmptyState, PageHeader } from './ui';
import styles from '../dealers.module.css';

type SortKey = 'name' | 'price-high' | 'price-low' | 'category';

const MAX_UPLOAD_BYTES = 12 * 1024 * 1024;
const MAX_IMAGE_DIMENSION = 900;
const IMAGE_QUALITY = 0.72;

// No object storage is configured for this app yet, so a stored (as opposed
// to externally-linked) product image lives as real binary in Postgres and is
// served by the API at a relative path (see toProductView in the API's
// dealer-view.ts) — never embedded in JSON. This app's API/web origins are
// different (127.0.0.1:4310 vs :3100 in dev), so that path needs the API's
// public origin prefixed before it's usable as an <img src>. An absolute
// http(s):// value is always an external link the dealer pasted in and is
// used as-is.
const API_PUBLIC_ORIGIN = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4310';
function resolveProductImageSrc(url: string | null | undefined): string | null {
  if (!url) return null;
  return url.startsWith('/') ? `${API_PUBLIC_ORIGIN}${url}` : url;
}

// The client downsizes/re-encodes a chosen photo before upload purely to keep
// the request small — the API re-resizes it again server-side as the
// authoritative small-and-safe stored copy (product-image.util.ts), so this
// step is a bandwidth optimisation, not the thing that guarantees "small".
function readImageFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('Please choose an image file (JPEG, PNG, WebP…).'));
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      reject(new Error('That photo is too large — please choose one under 12MB.'));
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Couldn't read that photo. Please try again."));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Couldn't read that photo. Please try again."));
      img.onload = () => {
        let { width, height } = img;
        if (width > MAX_IMAGE_DIMENSION || height > MAX_IMAGE_DIMENSION) {
          if (width > height) {
            height = Math.round((height * MAX_IMAGE_DIMENSION) / width);
            width = MAX_IMAGE_DIMENSION;
          } else {
            width = Math.round((width * MAX_IMAGE_DIMENSION) / height);
            height = MAX_IMAGE_DIMENSION;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error("Couldn't process that photo. Please try again."));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', IMAGE_QUALITY));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

// Deliberately omits imageUrl/imageDataUrl — see DealerProductDto's comment
// on the API: omitting both keys means "leave the stored image untouched".
// Resending p.imageUrl here would be actively wrong for a stored (relative-
// path) image — the API would try to parse it as a pasted external link and
// wipe the real stored bytes in the process. Used directly by quick actions
// (toggleAvailable) that never touch the image; the edit modal manages image
// state separately (see ProductModal's own upload/remove/link state) and
// merges it back in at submit time.
function toInput(p: DealerOwnerProductView): DealerProductInput {
  return {
    name: p.name,
    category: p.category,
    description: p.description,
    available: p.available,
    pricePence: p.pricePence,
    unit: p.unit,
  };
}

const EMPTY_DRAFT: DealerProductInput = {
  name: '',
  category: '',
  description: '',
  available: true,
  pricePence: null,
  unit: '',
};

function ProductModal({
  title,
  initial,
  currentImageUrl,
  busy,
  error,
  onCancel,
  onSave,
}: {
  title: string;
  initial: DealerProductInput;
  /** The product's existing displayable image URL (relative served-path or
   * external link) — kept separate from `initial` because it must never be
   * resent as-is; see the image state machine below. */
  currentImageUrl: string | null;
  busy: boolean;
  error: string | null;
  onCancel: () => void;
  onSave: (input: DealerProductInput) => void;
}) {
  const [draft, setDraft] = useState<DealerProductInput>(initial);
  const [priceText, setPriceText] = useState(
    initial.pricePence != null ? (initial.pricePence / 100).toFixed(2) : '',
  );
  // The product's image has exactly one of three fates each save: left alone,
  // replaced with a freshly uploaded photo, replaced with a pasted link, or
  // removed. `pastedLink`/`uploadedDataUrl`/`removed` track which (mutually
  // exclusive — each setter clears the other two) so submit() can send the
  // API an unambiguous instruction instead of ever re-deriving intent from
  // currentImageUrl (which, for a stored photo, is a relative path that must
  // never be echoed back as if it were a pasted link — see toInput() above).
  // Pre-fill with the existing value only when it's a real external link the
  // dealer can usefully re-edit — a relative served-path (stored upload) has
  // nothing meaningful to show as editable text, so the field starts empty
  // and the photo just shows in the preview below instead.
  const [pastedLink, setPastedLink] = useState(currentImageUrl && !currentImageUrl.startsWith('/') ? currentImageUrl : '');
  const [uploadedDataUrl, setUploadedDataUrl] = useState<string | null>(null);
  const [removed, setRemoved] = useState(false);
  const [imageBusy, setImageBusy] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const set = (patch: Partial<DealerProductInput>) => setDraft((d) => ({ ...d, ...patch }));

  const previewSrc = uploadedDataUrl ?? (removed ? null : resolveProductImageSrc(pastedLink || currentImageUrl));

  const onFileChosen = async (file: File | undefined) => {
    if (!file) return;
    setImageError(null);
    setImageBusy(true);
    try {
      const dataUrl = await readImageFileAsDataUrl(file);
      setUploadedDataUrl(dataUrl);
      setPastedLink('');
      setRemoved(false);
    } catch (e) {
      setImageError(e instanceof Error ? e.message : "Couldn't use that photo. Please try again.");
    } finally {
      setImageBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const onPasteLink = (value: string) => {
    setPastedLink(value);
    setUploadedDataUrl(null);
    // Clearing a field that HAD an existing image is a removal, not a no-op —
    // matches the old single-field behaviour where an empty imageUrl meant
    // "no image" (submit() used to do `draft.imageUrl?.trim() || null`).
    setRemoved(value.trim() === '' && !!currentImageUrl);
  };

  const onRemoveImage = () => {
    setRemoved(true);
    setUploadedDataUrl(null);
    setPastedLink('');
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onCancel]);

  const submit = () => {
    const pricePence = priceText.trim() ? Math.round(parseFloat(priceText) * 100) : null;
    const imagePatch: Partial<DealerProductInput> = uploadedDataUrl
      ? { imageDataUrl: uploadedDataUrl, imageUrl: undefined }
      : removed
        ? { imageUrl: null, imageDataUrl: null }
        : pastedLink.trim()
          ? { imageUrl: pastedLink.trim(), imageDataUrl: undefined }
          : {}; // untouched — omit both keys so the API leaves the stored image alone
    onSave({
      ...draft,
      name: draft.name.trim(),
      category: draft.category?.trim() || null,
      description: draft.description?.trim() || null,
      unit: draft.unit?.trim() || null,
      pricePence: Number.isFinite(pricePence as number) ? pricePence : null,
      ...imagePatch,
    });
  };

  return (
    <div className={styles.modalBackdrop} role="dialog" aria-modal="true" onClick={onCancel}>
      <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
        <p className={styles.modalTitle}>{title}</p>
        <p className={styles.modalSub}>Customers see this exactly as you fill it in — nothing is invented.</p>

        <div className={styles.imageField}>
          {previewSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={previewSrc} alt="" className={styles.imagePreview} onError={() => undefined} />
          ) : (
            <div className={styles.imagePreviewEmpty} aria-hidden>
              🍽️
            </div>
          )}
          <div className={styles.imageFieldBody}>
            <label className={styles.field} style={{ marginBottom: 6 }}>
              <span className={styles.fieldLabel}>Product image · optional</span>
              <input
                className={styles.input}
                placeholder="Paste an image link (https://…)"
                value={pastedLink}
                onChange={(e) => onPasteLink(e.target.value)}
              />
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => onFileChosen(e.target.files?.[0])}
            />
            <div className={styles.chips}>
              <button
                type="button"
                className={`${styles.btnSm} ${styles.ctaSecondary}`}
                onClick={() => fileInputRef.current?.click()}
                disabled={imageBusy}
              >
                {imageBusy ? 'Uploading…' : 'Upload photo'}
              </button>
              {previewSrc ? (
                <button type="button" className={styles.chip} onClick={onRemoveImage}>
                  Remove image
                </button>
              ) : null}
            </div>
            {imageError ? <p className={styles.error}>{imageError}</p> : null}
          </div>
        </div>

        <div className={styles.modalSection}>
          <p className={styles.modalSectionTitle}>Details</p>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Product name</span>
            <input
              className={styles.input}
              value={draft.name}
              placeholder="e.g. Jollof Rice"
              onChange={(e) => set({ name: e.target.value })}
            />
          </label>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>
              Description <span className={styles.fieldHint}>· optional</span>
            </span>
            <textarea
              className={styles.textarea}
              value={draft.description ?? ''}
              onChange={(e) => set({ description: e.target.value })}
            />
          </label>
          <div className={styles.fieldRow}>
            <label className={styles.field} style={{ marginBottom: 0 }}>
              <span className={styles.fieldLabel}>Category</span>
              <input
                className={styles.input}
                value={draft.category ?? ''}
                placeholder="African Food"
                onChange={(e) => set({ category: e.target.value })}
              />
            </label>
            <label className={styles.field} style={{ marginBottom: 0 }}>
              <span className={styles.fieldLabel}>Unit</span>
              <input
                className={styles.input}
                value={draft.unit ?? ''}
                placeholder="per bottle, per kg…"
                onChange={(e) => set({ unit: e.target.value })}
              />
            </label>
          </div>
        </div>

        <div className={styles.modalSection}>
          <p className={styles.modalSectionTitle}>Price &amp; availability</p>
          <div className={styles.fieldRow}>
            <label className={styles.field} style={{ marginBottom: 0 }}>
              <span className={styles.fieldLabel}>
                Price <span className={styles.fieldHint}>· optional</span>
              </span>
              <input
                className={styles.input}
                inputMode="decimal"
                placeholder="£ 8.50"
                value={priceText}
                onChange={(e) => setPriceText(e.target.value)}
              />
            </label>
          </div>
          <div className={styles.switchRow}>
            <span className={styles.fieldLabel} style={{ marginBottom: 0 }}>
              Available to customers
            </span>
            <button
              type="button"
              className={`${styles.chip} ${styles.chipToggle} ${draft.available ? styles.chipToggleOn : ''}`}
              aria-pressed={draft.available}
              onClick={() => set({ available: !draft.available })}
            >
              {draft.available ? 'Available' : 'Unavailable'}
            </button>
          </div>
        </div>

        {error ? <p className={styles.error}>{error}</p> : null}

        <div className={styles.modalActions}>
          <button type="button" className={styles.ctaSecondary} onClick={onCancel} disabled={busy}>
            Cancel
          </button>
          <button type="button" className={styles.ctaPrimary} onClick={submit} disabled={busy || !draft.name.trim()}>
            {busy ? 'Saving…' : 'Save product'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function ProductsManager({ initialDealer }: { initialDealer: DealerView }) {
  const [dealer, setDealer] = useState(initialDealer);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [availability, setAvailability] = useState<'all' | 'available' | 'unavailable'>('all');
  const [sort, setSort] = useState<SortKey>('name');
  const [modal, setModal] = useState<{ mode: 'add' | 'edit'; product?: DealerOwnerProductView } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const categories = useMemo(
    () => [...new Set(dealer.products.map((p) => p.category).filter((c): c is string => !!c))].sort(),
    [dealer.products],
  );

  const visible = useMemo(() => {
    let list = dealer.products;
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter((p) => p.name.toLowerCase().includes(q) || (p.category ?? '').toLowerCase().includes(q));
    }
    if (category !== 'all') list = list.filter((p) => p.category === category);
    if (availability !== 'all') list = list.filter((p) => (availability === 'available' ? p.available : !p.available));
    const sorted = [...list];
    sorted.sort((a, b) => {
      if (sort === 'name') return a.name.localeCompare(b.name);
      if (sort === 'category') return (a.category ?? '').localeCompare(b.category ?? '');
      const ap = a.pricePence ?? -1;
      const bp = b.pricePence ?? -1;
      return sort === 'price-high' ? bp - ap : ap - bp;
    });
    return sorted;
  }, [dealer.products, query, category, availability, sort]);

  const flash = (text: string) => {
    setToast(text);
    setTimeout(() => setToast((t) => (t === text ? null : t)), 3200);
  };

  const runSave = async (input: DealerProductInput) => {
    setBusy(true);
    setError(null);
    try {
      const updated =
        modal?.mode === 'edit' && modal.product
          ? await dealerApi.updateProduct(modal.product.id, input)
          : await dealerApi.addProduct(input);
      setDealer(updated);
      setModal(null);
      flash(modal?.mode === 'edit' ? 'Product updated.' : 'Product added.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save that product.');
    } finally {
      setBusy(false);
    }
  };

  const toggleAvailable = async (p: DealerOwnerProductView) => {
    setBusy(true);
    try {
      setDealer(await dealerApi.updateProduct(p.id, { ...toInput(p), available: !p.available }));
      flash(p.available ? 'Marked unavailable.' : 'Marked available.');
    } catch (e) {
      flash(e instanceof Error ? e.message : 'Could not update availability.');
    } finally {
      setBusy(false);
    }
  };

  const duplicate = async (p: DealerOwnerProductView) => {
    setBusy(true);
    try {
      // Server-side copy — carries over any uploaded image's bytes directly,
      // no client base64 round-trip needed (see duplicateProduct on the API).
      setDealer(await dealerApi.duplicateProduct(p.id));
      flash('Product duplicated.');
    } catch (e) {
      flash(e instanceof Error ? e.message : 'Could not duplicate that product.');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (p: DealerOwnerProductView) => {
    if (!confirm(`Delete "${p.name}"? This can't be undone.`)) return;
    setBusy(true);
    try {
      setDealer(await dealerApi.removeProduct(p.id));
      flash('Product deleted.');
    } catch (e) {
      flash(e instanceof Error ? e.message : 'Could not delete that product.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Products"
        description="Manage the food and products customers can discover through FoodPadi."
        actions={
          <button type="button" className={styles.ctaPrimary} onClick={() => setModal({ mode: 'add' })}>
            + Add product
          </button>
        }
      />

      {dealer.products.length === 0 ? (
        <EmptyState
          icon="🍲"
          title="No products yet"
          text="Add what you sell — a price is optional. Products drive matching in FoodPadi search."
          action={
            <button type="button" className={styles.ctaPrimary} onClick={() => setModal({ mode: 'add' })}>
              Add your first product
            </button>
          }
        />
      ) : (
        <>
          <div className={styles.toolbar}>
            <input
              className={`${styles.input} ${styles.searchInput}`}
              placeholder="Search products…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search products"
            />
            <select className={styles.select} style={{ width: 'auto' }} value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="all">All categories</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <select
              className={styles.select}
              style={{ width: 'auto' }}
              value={availability}
              onChange={(e) => setAvailability(e.target.value as typeof availability)}
            >
              <option value="all">All availability</option>
              <option value="available">Available</option>
              <option value="unavailable">Unavailable</option>
            </select>
            <select className={styles.select} style={{ width: 'auto' }} value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
              <option value="name">Sort: Name</option>
              <option value="category">Sort: Category</option>
              <option value="price-high">Sort: Price (high–low)</option>
              <option value="price-low">Sort: Price (low–high)</option>
            </select>
          </div>

          {visible.length === 0 ? (
            <EmptyState icon="🔍" title="No products match your filters" text="Try clearing the search or filters above." />
          ) : (
            <div className={styles.productGrid}>
              {visible.map((p) => (
                <div className={styles.productCard} key={p.id}>
                  {p.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={resolveProductImageSrc(p.imageUrl)!} alt={p.name} className={styles.productThumb} />
                  ) : (
                    <div className={styles.productThumbEmpty} aria-hidden>
                      🍽️
                    </div>
                  )}
                  <div className={styles.productBody}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                      <span className={styles.productName}>{p.name}</span>
                      <span className={`${styles.badge} ${p.available ? styles.badgeLime : styles.badgeNeutral}`}>
                        {p.available ? 'Active' : 'Disabled'}
                      </span>
                    </div>
                    <span className={styles.productMeta}>{p.category ?? 'Uncategorised'}</span>
                    <span className={styles.productPrice}>{p.priceText ?? 'Price on request'}</span>
                  </div>
                  <div className={styles.productActions}>
                    <button type="button" className={`${styles.btnSm} ${styles.ctaSecondary}`} onClick={() => setModal({ mode: 'edit', product: p })}>
                      Edit
                    </button>
                    <button type="button" className={`${styles.btnSm} ${styles.ctaSecondary}`} onClick={() => duplicate(p)} disabled={busy}>
                      Duplicate
                    </button>
                    <button type="button" className={`${styles.btnSm} ${styles.ctaSecondary}`} onClick={() => toggleAvailable(p)} disabled={busy}>
                      {p.available ? 'Disable' : 'Enable'}
                    </button>
                    <button type="button" className={`${styles.btnSm} ${styles.btnDanger}`} onClick={() => remove(p)} disabled={busy}>
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {modal ? (
        <ProductModal
          title={modal.mode === 'add' ? 'Add product' : 'Edit product'}
          initial={modal.product ? toInput(modal.product) : EMPTY_DRAFT}
          currentImageUrl={modal.product?.imageUrl ?? null}
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
          <div className={styles.toast + ' ' + styles.toastOk}>{toast}</div>
        </div>
      ) : null}
    </>
  );
}
