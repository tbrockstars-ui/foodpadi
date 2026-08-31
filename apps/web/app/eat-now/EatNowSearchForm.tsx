'use client';

import { useState } from 'react';
import type { FoodIdeaView } from '@foodpadi/shared';
import styles from './eat-now.module.css';
import { LocalFoodSearch } from './LocalFoodSearch';
import { FoodImage } from '../../components/FoodImage';

const BUDGET_LABEL: Record<FoodIdeaView['budgetTier'], string> = {
  low: '£',
  medium: '££',
  high: '£££',
};

function formatPence(pence: number): string {
  return pence % 100 === 0 ? `£${pence / 100}` : `£${(pence / 100).toFixed(2)}`;
}

/** Web counterpart to apps/mobile/src/screens/EatNowScreen.tsx's search step. */
export function EatNowSearchForm() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<FoodIdeaView[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const search = async () => {
    const trimmed = query.trim();
    if (!trimmed) return;
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/proxy/eat-now/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: trimmed }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { message?: string | string[] };
        const message = Array.isArray(data.message) ? data.message.join('. ') : data.message;
        throw new Error(message ?? 'Something went wrong searching for food.');
      }
      setResults((await res.json()) as FoodIdeaView[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong searching for food.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h1 className={styles.title}>What are you after?</h1>
      <p className={styles.subtitle}>Tell us what you fancy — a dish, a cuisine, anything.</p>

      <div className={styles.searchRow}>
        <input
          className={styles.searchInput}
          type="text"
          placeholder="e.g. something spicy and quick"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') search();
          }}
        />
        <button type="button" className={styles.primaryButton} onClick={search} disabled={!query.trim() || loading}>
          {loading ? 'Looking…' : 'Find food'}
        </button>
      </div>

      {error ? <p className={styles.errorText}>{error}</p> : null}

      {results !== null ? (
        <>
          <p className={styles.disclaimerNote}>
            Example suggestions from a small curated list — cuisine and price band are real; distance,
            delivery time and exact price are illustrative estimates, not live data from any restaurant.
          </p>
          {results.length === 0 ? (
            <p className={styles.emptyText}>Nothing matched that. Try different words, like a cuisine or &quot;quick&quot;.</p>
          ) : (
            results.map((idea) => (
              <div key={idea.id} className={styles.resultCard}>
                <FoodImage image={idea.image} alt={idea.title} className={styles.resultImage} />
                <p className={styles.resultTitle}>{idea.title}</p>
                <p className={styles.resultBody}>{idea.description}</p>
                <p className={styles.estimateText}>
                  ~{idea.distanceMiles} mi · {idea.deliveryMinutesMin}–{idea.deliveryMinutesMax} min ·{' '}
                  {formatPence(idea.pricePenceMin)}–{formatPence(idea.pricePenceMax)}
                </p>
                <div className={styles.tagRow}>
                  <span className={styles.tag}>{idea.cuisine}</span>
                  <span className={styles.tag}>{BUDGET_LABEL[idea.budgetTier]}</span>
                </div>
              </div>
            ))
          )}
        </>
      ) : null}

      <LocalFoodSearch query={query} />
    </div>
  );
}
