/**
 * Guest advertising is a possible future revenue stream (guest-mode brief
 * §14) — guests make no paid AI calls, so ads are a way to fund the
 * acquisition funnel. Nothing is integrated: this flag stays `false` until a
 * real ad provider is chosen and wired up. When `true`, <AdSlot> renders a
 * clearly-labelled placeholder box in its approved positions so layout and
 * placement can be reviewed without a network or a fake ad.
 */
export const ADS_ENABLED = false;

export type AdPlacement = 'decide_results' | 'eat_now_results';
