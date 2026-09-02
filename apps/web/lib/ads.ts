/**
 * Guest advertising is a possible future revenue stream (guest-mode brief
 * §14) — guests make no paid AI calls. Nothing is integrated: this flag stays
 * `false` until a real provider is wired up. When `true`, <AdSlot> renders a
 * labelled placeholder in its approved positions so layout can be reviewed.
 */
export const ADS_ENABLED = false;

export type AdPlacement = 'decide_results' | 'eat_now_results';
