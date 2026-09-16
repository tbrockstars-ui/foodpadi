/**
 * Centralised defaults for the in-app Guest / Trial / Paid model. The
 * authoritative, admin-tunable values live on the `billing_config` row
 * (BillingConfig.appTrialDays / BillingConfig.trialAiLimit, read via
 * BillingConfigService). These constants are only the pre-config fallback,
 * used before an admin has ever saved the billing config and by any caller
 * that must not depend on the DB read (e.g. a unit test).
 *
 * Do not hard-code these values anywhere else — read BillingConfigService, or
 * import from here.
 */
export const TRIAL_DURATION_DAYS = 7;
export const TRIAL_AI_LIMIT = 20;
