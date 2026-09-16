// Pure profile-completeness scoring (dealer brief §17). A more complete profile
// is a stronger listing → better search quality and Featured eligibility. The
// score is honest signal only — the portal never claims a field "guarantees #1
// ranking" (brief §17). Exported standalone so both DealerPortalService (shown
// to the dealer) and DealerSearchProfileService (denormalised for ranking) use
// one definition.

export interface CompletenessInput {
  name?: string | null;
  description?: string | null;
  dealerType?: string | null;
  phone?: string | null;
  websiteUrl?: string | null;
  orderUrl?: string | null;
  whatsapp?: string | null;
  openingHours?: unknown;
  categories?: string[] | null;
  cuisines?: string[] | null;
  locationCount?: number;
  productCount?: number;
}

// Each item is (weight, satisfied?), ordered roughly by how much it improves a
// real search result. Raw weights don't need to sum to 100 — the score is
// normalised to earned/total below.
export function scoreDealerCompleteness(d: CompletenessInput): number {
  const hasText = (v?: string | null) => typeof v === 'string' && v.trim().length > 0;
  const hasList = (v?: string[] | null) => Array.isArray(v) && v.some((x) => x.trim().length > 0);
  const hasHours =
    d.openingHours != null &&
    typeof d.openingHours === 'object' &&
    Object.keys(d.openingHours as Record<string, unknown>).length > 0;
  const hasContact = hasText(d.phone) || hasText(d.websiteUrl) || hasText(d.orderUrl) || hasText(d.whatsapp);

  const items: [number, boolean][] = [
    [12, hasText(d.name)],
    [10, hasText(d.dealerType)],
    [18, (d.locationCount ?? 0) > 0],
    [18, (d.productCount ?? 0) > 0],
    [14, hasList(d.categories)],
    [8, hasList(d.cuisines)],
    [12, hasContact],
    [8, hasHours],
    [10, hasText(d.description)],
  ];
  const total = items.reduce((sum, [w]) => sum + w, 0);
  const earned = items.reduce((sum, [w, ok]) => sum + (ok ? w : 0), 0);
  return Math.round((earned / total) * 100);
}

/**
 * The human-readable list of what still blocks a listing going live / reaching
 * Featured eligibility — shown in the onboarding wizard and the dashboard's
 * "complete your profile" nudge (brief §17). `hardMissing` blocks activation;
 * `softMissing` only holds back completeness/Featured.
 */
export function dealerMissingFields(d: CompletenessInput): {
  hardMissing: string[];
  softMissing: string[];
} {
  const hasText = (v?: string | null) => typeof v === 'string' && v.trim().length > 0;
  const hasList = (v?: string[] | null) => Array.isArray(v) && v.some((x) => x.trim().length > 0);

  const hardMissing: string[] = [];
  if (!hasText(d.name)) hardMissing.push('Business name');
  if (!hasText(d.dealerType)) hardMissing.push('Business type');
  if ((d.locationCount ?? 0) === 0) hardMissing.push('At least one location');
  if ((d.productCount ?? 0) === 0 && !hasList(d.categories)) {
    hardMissing.push('At least one product or category');
  }
  if (
    !hasText(d.phone) &&
    !hasText(d.websiteUrl) &&
    !hasText(d.orderUrl) &&
    !hasText(d.whatsapp)
  ) {
    hardMissing.push('A way for customers to reach you (phone, website, order link or WhatsApp)');
  }

  const softMissing: string[] = [];
  if (!hasText(d.description)) softMissing.push('Business description');
  if (!hasList(d.cuisines)) softMissing.push('Cuisines');
  if (
    d.openingHours == null ||
    typeof d.openingHours !== 'object' ||
    Object.keys(d.openingHours as Record<string, unknown>).length === 0
  ) {
    softMissing.push('Opening hours');
  }

  return { hardMissing, softMissing };
}
