'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import type { DealerRatingsResponse } from '@foodpadi/shared';
import { StarRating } from '../../../components/StarRating';
import styles from './DealerRatings.module.css';

type MineState = 'loading' | 'signed-out' | { rating: number; comment: string | null };

/**
 * Post-visit customer ratings (user instruction 2026-09-11) — a star (1-5) +
 * optional short comment, one per customer per dealer, editable by the rater.
 * The read side is public (works for a logged-out visitor and search
 * crawlers); rating requires a real FoodPadi account, prompted inline rather
 * than blocking the page. No reviewer identity is ever shown — every entry
 * but the caller's own is a generic "FoodPadi customer" label (brief §42).
 */
export function DealerRatings({ slug }: { slug: string }) {
  const [data, setData] = useState<DealerRatingsResponse | null>(null);
  const [mine, setMine] = useState<MineState>('loading');
  const [draftRating, setDraftRating] = useState(0);
  const [draftComment, setDraftComment] = useState('');
  const [hoverStar, setHoverStar] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadList = useCallback(
    async (page = 1) => {
      const res = await fetch(`/api/proxy/dealers/${slug}/ratings?page=${page}`);
      if (!res.ok) return;
      const body = (await res.json()) as DealerRatingsResponse;
      setData((prev) => (page === 1 || !prev ? body : { ...body, ratings: [...prev.ratings, ...body.ratings] }));
    },
    [slug],
  );

  useEffect(() => {
    void loadList(1);
    fetch(`/api/proxy/dealers/${slug}/ratings/me`).then(async (res) => {
      if (res.status === 401 || res.status === 403) {
        setMine('signed-out');
        return;
      }
      if (!res.ok) return;
      const body = (await res.json().catch(() => null)) as { rating: number; comment: string | null } | null;
      if (body) {
        setMine(body);
        setDraftRating(body.rating);
        setDraftComment(body.comment ?? '');
      } else {
        setMine({ rating: 0, comment: null }); // signed in, hasn't rated yet
      }
    });
  }, [slug, loadList]);

  const submit = async () => {
    if (draftRating < 1) {
      setError('Choose a star rating.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/proxy/dealers/${slug}/ratings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating: draftRating, comment: draftComment.trim() || undefined }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(Array.isArray(body.message) ? body.message.join('. ') : body.message ?? 'Could not save your rating.');
      }
      const updated = (await res.json()) as DealerRatingsResponse;
      setData(updated);
      setMine({ rating: draftRating, comment: draftComment.trim() || null });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save your rating.');
    } finally {
      setBusy(false);
    }
  };

  const removeMine = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/proxy/dealers/${slug}/ratings/me`, { method: 'DELETE' });
      if (res.ok) {
        const updated = (await res.json()) as DealerRatingsResponse;
        setData(updated);
      }
      setMine({ rating: 0, comment: null });
      setDraftRating(0);
      setDraftComment('');
    } finally {
      setBusy(false);
    }
  };

  if (!data) return null;

  return (
    <section className={styles.wrap}>
      <h2 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 8px' }}>Ratings from customers</h2>

      <div className={styles.summaryRow}>
        {data.average != null ? (
          <StarRating average={data.average} count={data.count} size={18} />
        ) : (
          <span className={styles.noRatings}>No ratings yet — be the first to rate your visit.</span>
        )}
      </div>

      {mine === 'signed-out' ? (
        <p className={styles.signInPrompt}>
          <Link href={`/login?next=${encodeURIComponent(`/dealer/${slug}`)}`}>Sign in</Link> to rate your experience
          with this business.
        </p>
      ) : mine === 'loading' ? null : (
        <div className={styles.form}>
          <p className={styles.formTitle}>
            {mine.rating > 0 ? 'Your rating' : "Bought food here? Rate your experience"}
          </p>
          <div className={styles.starPicker}>
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                className={`${styles.starBtn} ${n <= (hoverStar || draftRating) ? styles.starBtnOn : ''}`}
                onMouseEnter={() => setHoverStar(n)}
                onMouseLeave={() => setHoverStar(0)}
                onClick={() => setDraftRating(n)}
                aria-label={`${n} star${n === 1 ? '' : 's'}`}
              >
                ★
              </button>
            ))}
          </div>
          <textarea
            className={styles.textarea}
            placeholder="Optional — what did you think? (visible to other customers, not the dealer's identity)"
            value={draftComment}
            maxLength={600}
            onChange={(e) => setDraftComment(e.target.value)}
          />
          <div className={styles.actions}>
            <button type="button" className={styles.submitBtn} onClick={submit} disabled={busy}>
              {busy ? 'Saving…' : mine.rating > 0 ? 'Update rating' : 'Submit rating'}
            </button>
            {mine.rating > 0 ? (
              <button type="button" className={styles.removeBtn} onClick={removeMine} disabled={busy}>
                Remove your rating
              </button>
            ) : null}
          </div>
          {error ? <p className={styles.error}>{error}</p> : null}
        </div>
      )}

      {data.ratings.length > 0 ? (
        <ul className={styles.list}>
          {data.ratings.map((r) => (
            <li key={r.id} className={`${styles.item} ${r.isMine ? styles.itemMine : ''}`}>
              <div className={styles.itemHead}>
                <StarRating average={r.rating} count={1} showCount={false} size={13} />
                <span className={styles.itemAuthor}>{r.isMine ? 'You' : 'FoodPadi customer'}</span>
                <span className={styles.itemDate}>{new Date(r.createdAt).toLocaleDateString()}</span>
              </div>
              {r.comment ? <p className={styles.itemComment}>{r.comment}</p> : null}
            </li>
          ))}
        </ul>
      ) : null}

      {data.hasMore ? (
        <button type="button" className={styles.loadMore} onClick={() => loadList(data.page + 1)}>
          Show more ratings
        </button>
      ) : null}
    </section>
  );
}
