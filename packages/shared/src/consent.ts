// Marketing-consent wording — kept as a single source of truth so the copy
// shown on a signup form and the "version" stamped against a stored consent
// can never drift apart. Bump MARKETING_CONSENT_VERSION whenever the wording
// below changes; existing consents keep the version they were given under.
// Deliberately separate from any product/account signup — per the launch
// brief, joining the waitlist, creating an account or using the app is NOT
// itself marketing consent.
export const MARKETING_CONSENT_VERSION = '2026-09-15';

export const MARKETING_CONSENT_COPY =
  "Yes, I'd like to receive FoodPadi news, useful food ideas and launch updates by email.";
