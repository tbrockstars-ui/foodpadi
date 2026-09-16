/**
 * The FoodPadi Verified mark — a filled scalloped badge with a check cut-out,
 * the same visual language as X/Twitter's verified checkmark (user request
 * 2026-09-11), in FoodPadi's green rather than blue. Shown inline next to a
 * dealer's name — never a substitute for the "Sponsored" label, which stays a
 * separate, explicit text pill (paid placement must never look like a trust
 * mark — dealer brief §38).
 *
 * Only ever rendered from `DealerCardView.isVerified` / `DealerProfileView.
 * isVerified`, which the API only sets once FoodPadi has actually completed
 * verification (brief §23) — never implied by an active subscription alone.
 */
export function VerifiedBadge({
  size = 15,
  title = 'FoodPadi Verified',
  className,
}: {
  size?: number;
  title?: string;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      role="img"
      aria-label={title}
      className={className}
      style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0 }}
    >
      <title>{title}</title>
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M8.603 3.799A4.49 4.49 0 0112 2.25c1.357 0 2.573.6 3.397 1.549a4.49 4.49 0 013.498 1.307 4.491 4.491 0 011.307 3.497A4.49 4.49 0 0121.75 12a4.49 4.49 0 01-1.549 3.397 4.491 4.491 0 01-1.307 3.497 4.491 4.491 0 01-3.497 1.307A4.49 4.49 0 0112 21.75a4.49 4.49 0 01-3.397-1.549 4.49 4.49 0 01-3.498-1.306 4.491 4.491 0 01-1.307-3.498A4.49 4.49 0 012.25 12c0-1.357.6-2.573 1.549-3.397a4.49 4.49 0 011.307-3.497 4.49 4.49 0 013.497-1.307zm7.007 6.387a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z"
        fill="var(--success)"
      />
    </svg>
  );
}
