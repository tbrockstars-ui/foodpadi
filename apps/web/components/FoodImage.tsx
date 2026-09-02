'use client';

import { useState } from 'react';
import type { FoodImageView } from '@foodpadi/shared';
import styles from './FoodImage.module.css';

const PROVIDER_LABEL: Record<FoodImageView['provider'], string> = {
  pexels: 'Pexels',
  unsplash: 'Unsplash',
};

interface Props {
  /** Resolved server-side. null/undefined => compact icon fallback, no network request. */
  image: FoodImageView | null | undefined;
  /** Dish name — used as the image alt text. */
  alt: string;
  /** Load eagerly instead of lazily (default lazy — brief §20/§27). */
  eager?: boolean;
  className?: string;
  /** Small overlay label in the image's corner — e.g. "Vegan". Shown whenever
   * passed, on the real photo or the icon fallback alike (the fact is still
   * true either way). Omit when it doesn't apply. */
  badge?: string;
}

/**
 * The representative food photo on a recommendation card — a small, supporting
 * visual for the "what should I eat" decision (visual-redesign brief §17: the
 * image supports the decision, it never overpowers it). Compact fixed-height
 * frame, skeleton shimmer while the photo loads, fades in on load. If there's
 * no image, or the URL fails to load, it falls back to a small food icon on a
 * branded tint — never a broken image, unrelated stock, or a big empty box.
 * Attribution sits subtly beneath, per the Pexels/Unsplash API terms. Mobile
 * counterpart: apps/mobile/src/components/FoodImage.tsx.
 */
export function FoodImage({ image, alt, eager, className, badge }: Props) {
  const [status, setStatus] = useState<'loading' | 'loaded' | 'error'>('loading');

  const showIconFallback = !image || status === 'error';

  return (
    <div className={`${styles.wrap} ${className ?? ''}`}>
      <div className={`${styles.frame} ${showIconFallback ? styles.frameFallback : ''}`}>
        {badge ? <span className={styles.badge}>{badge}</span> : null}
        {showIconFallback ? (
          <span className={styles.fallbackIcon} role="img" aria-label={alt || 'food'}>
            🍽️
          </span>
        ) : (
          <>
            {status === 'loading' ? <div className={styles.skeleton} aria-hidden="true" /> : null}
            {/* eslint-disable-next-line @next/next/no-img-element -- remote provider CDN, same as IntentCard */}
            <img
              src={image.url}
              alt={alt}
              loading={eager ? 'eager' : 'lazy'}
              decoding="async"
              className={`${styles.img} ${status === 'loaded' ? styles.imgLoaded : ''}`}
              onLoad={() => setStatus('loaded')}
              onError={() => setStatus('error')}
            />
          </>
        )}
      </div>

      {image && status === 'loaded' ? (
        <p className={styles.credit}>
          Photo:{' '}
          {image.photographerUrl ? (
            <a href={image.photographerUrl} target="_blank" rel="noopener noreferrer nofollow">
              {image.photographer}
            </a>
          ) : (
            image.photographer
          )}{' '}
          /{' '}
          <a href={image.sourceUrl} target="_blank" rel="noopener noreferrer nofollow">
            {PROVIDER_LABEL[image.provider]}
          </a>
          {image.isRepresentative ? ' · representative image' : null}
        </p>
      ) : null}
    </div>
  );
}
