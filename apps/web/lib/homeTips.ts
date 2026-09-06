// Static cooking-tip copy for the sidebar's "Today's tip" card — rotates
// deterministically by day of year (not per-render random) so the tip stays
// the same across navigation within a day, and reloading doesn't flicker to
// a different one. Purely presentational copy, no data dependency.
const TIPS = [
  'Add herbs at the end for more flavour and aroma.',
  'Let meat rest for a few minutes after cooking — it stays juicier.',
  "Salt your pasta water: it should taste like the sea.",
  'Toast spices in a dry pan for a minute before using — it wakes up their flavour.',
  'Prep all your ingredients before you start cooking — it makes everything faster.',
  'A squeeze of lemon at the end brightens almost any dish.',
  "Don't overcrowd the pan — food steams instead of browning.",
] as const;

function dayOfYear(date: Date): number {
  const start = Date.UTC(date.getUTCFullYear(), 0, 0);
  const diff = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) - start;
  return Math.floor(diff / 86_400_000);
}

export function getTodaysTip(): string {
  return TIPS[dayOfYear(new Date()) % TIPS.length];
}
