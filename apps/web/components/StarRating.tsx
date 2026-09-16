import styles from './StarRating.module.css';

/**
 * Read-only fractional star bar for a dealer's post-visit customer rating
 * (user instruction 2026-09-11) — e.g. ★★★★☆ 4.6 (23). Renders nothing when
 * there are no ratings yet (never shown as "0 stars" — an unrated dealer is
 * just unrated, not badly rated).
 */
export function StarRating({
  average,
  count,
  size = 14,
  showCount = true,
}: {
  average: number | null;
  count: number;
  size?: number;
  showCount?: boolean;
}) {
  if (average == null || count === 0) return null;
  const pct = `${(Math.max(0, Math.min(5, average)) / 5) * 100}%`;
  return (
    <span
      className={styles.wrap}
      role="img"
      aria-label={`${average.toFixed(1)} out of 5 stars, from ${count} rating${count === 1 ? '' : 's'}`}
    >
      <span className={styles.stack} style={{ fontSize: size }}>
        <span className={styles.bg}>★★★★★</span>
        <span className={styles.fg} style={{ width: pct }} aria-hidden>
          ★★★★★
        </span>
      </span>
      {showCount ? (
        <span className={styles.count}>
          {average.toFixed(1)} ({count})
        </span>
      ) : null}
    </span>
  );
}
