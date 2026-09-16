// Row → client-view mappers. The customer views (DealerProfileView /
// DealerCardView) deliberately omit owner identity, payment state and any
// unpublished price (dealer brief §42/§51/§64); the owner views add the fields
// the portal needs. One place so the web + mobile contract can't drift.

import type { Dealer, DealerLocation, DealerProduct, DealerSubscription } from '@prisma/client';
import {
  DEALER_FEATURED_MIN_COMPLETENESS,
  type DealerContactView,
  type DealerOwnerLocationView,
  type DealerOwnerProductView,
  type DealerProductView,
  type DealerProfileView,
  type DealerServiceType,
  type DealerType,
  type DealerVerificationStatus,
  type DealerView,
} from '@foodpadi/shared';

export type DealerWithChildren = Dealer & {
  locations: DealerLocation[];
  products: DealerProduct[];
};

function formatPrice(pricePence: number | null, unit: string | null): string | null {
  if (pricePence == null) return null;
  const s = pricePence % 100 === 0 ? `£${pricePence / 100}` : `£${(pricePence / 100).toFixed(2)}`;
  return unit ? `${s} / ${unit}` : s;
}

function whatsappUrl(raw: string | null): string | null {
  if (!raw) return null;
  const digits = raw.replace(/[^\d]/g, '');
  return digits.length >= 7 ? `https://wa.me/${digits}` : null;
}

function openingHours(value: unknown): Record<string, string> | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (typeof v === 'string' && v.trim()) out[k] = v;
    }
    return Object.keys(out).length ? out : null;
  }
  return null;
}

// An uploaded photo's bytes live in imageData/imageMimeType (see schema.prisma)
// and are only ever served via GET /dealers/products/:id/image — never
// embedded in a JSON view. This resolves to that relative path when a product
// has one, or the dealer's external https:// link otherwise. A relative path
// (vs. an absolute external URL) is the client's signal for which one it got —
// see resolveProductImageSrc in ProductsManager.tsx.
function productImageUrl(p: DealerProduct): string | null {
  if (p.imageData) return `/dealers/products/${p.id}/image`;
  return p.imageUrl;
}

export function toProductView(p: DealerProduct): DealerProductView {
  return {
    name: p.name,
    category: p.category,
    description: p.description,
    imageUrl: productImageUrl(p),
    available: p.available,
    priceText: formatPrice(p.pricePence, p.unit),
  };
}

export function toOwnerProductView(p: DealerProduct): DealerOwnerProductView {
  return { ...toProductView(p), id: p.id, pricePence: p.pricePence, unit: p.unit };
}

export function toOwnerLocationView(l: DealerLocation): DealerOwnerLocationView {
  return {
    id: l.id,
    label: l.label,
    addressLine: l.addressLine,
    locality: l.locality,
    city: l.city,
    region: l.region,
    postcode: l.postcode,
    countryCode: l.countryCode,
    latitude: l.latitude,
    longitude: l.longitude,
    isPrimary: l.isPrimary,
    serviceAreas: l.serviceAreas ?? [],
    serviceRadiusMiles: l.serviceRadiusMiles,
  };
}

/** listingStatus === 'active' && subscription active. */
export function isLiveToCustomers(d: Dealer, subscriptionActive: boolean): boolean {
  return d.listingStatus === 'active' && subscriptionActive;
}

export function toDealerView(
  d: DealerWithChildren,
  subscriptionActive: boolean,
): DealerView {
  const live = isLiveToCustomers(d, subscriptionActive);
  return {
    id: d.id,
    slug: d.slug,
    name: d.name,
    description: d.description,
    dealerType: d.dealerType as DealerType,
    phone: d.phone,
    websiteUrl: d.websiteUrl,
    orderUrl: d.orderUrl,
    whatsapp: d.whatsapp,
    openingHours: openingHours(d.openingHours),
    categories: d.categories,
    cuisines: d.cuisines,
    productKeywords: d.productKeywords,
    dietaryTags: d.dietaryTags,
    serviceType: d.serviceType as DealerServiceType[],
    listingStatus: d.listingStatus as DealerView['listingStatus'],
    approvalNote: d.approvalNote,
    verificationStatus: d.verificationStatus as DealerVerificationStatus,
    profileCompleteness: d.profileCompleteness,
    isLiveToCustomers: live,
    featuredEligible: live && d.profileCompleteness >= DEALER_FEATURED_MIN_COMPLETENESS,
    ratingAverage: d.ratingAverage,
    ratingCount: d.ratingCount,
    createdAt: d.createdAt.toISOString(),
    submittedAt: d.submittedAt?.toISOString() ?? null,
    activatedAt: d.activatedAt?.toISOString() ?? null,
    locations: d.locations.map(toOwnerLocationView),
    products: d.products.map(toOwnerProductView),
  };
}

export interface ProfileViewOptions {
  isSponsored?: boolean;
  distanceMiles?: number | null;
  matchedTerms?: string[];
  relevanceScore?: number;
}

/**
 * The customer-facing dealer page + card payload. Contact channels are only
 * populated from real dealer-supplied values; a missing one stays null and the
 * client simply doesn't render that button (brief §27).
 */
export function toDealerProfileView(
  d: DealerWithChildren,
  opts: ProfileViewOptions = {},
): DealerProfileView {
  const primary = d.locations.find((l) => l.isPrimary) ?? d.locations[0] ?? null;
  const contact: DealerContactView = {
    phone: d.phone,
    websiteUrl: d.websiteUrl,
    orderUrl: d.orderUrl,
    whatsappUrl: whatsappUrl(d.whatsapp),
  };
  return {
    id: d.id,
    slug: d.slug,
    name: d.name,
    dealerType: d.dealerType as DealerType,
    categories: d.categories,
    cuisines: d.cuisines,
    primaryLocality: primary?.locality ?? null,
    distanceMiles: opts.distanceMiles ?? null,
    isVerified: d.verificationStatus === 'verified',
    isSponsored: opts.isSponsored ?? false,
    matchedTerms: opts.matchedTerms ?? [],
    relevanceScore: opts.relevanceScore ?? 0,
    ratingAverage: d.ratingAverage,
    ratingCount: d.ratingCount,
    description: d.description,
    openingHours: openingHours(d.openingHours),
    contact,
    locations: d.locations.map((l) => ({
      label: l.label,
      locality: l.locality,
      city: l.city,
      region: l.region,
      postcode: l.postcode,
      countryCode: l.countryCode,
      latitude: l.latitude,
      longitude: l.longitude,
      isPrimary: l.isPrimary,
      serviceAreas: l.serviceAreas ?? [],
    })),
    serviceAreas: [...new Set(d.locations.flatMap((l) => l.serviceAreas ?? []))],
    products: d.products.filter((p) => p.available !== false).map(toProductView),
    serviceType: d.serviceType as DealerServiceType[],
    dietaryTags: d.dietaryTags,
  };
}
