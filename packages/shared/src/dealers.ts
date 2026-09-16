// FoodPadi Food Dealer Network — the ONE shared contract consumed identically by
// apps/web (via /api/proxy + lib/serverApi) and apps/mobile (via src/api/client)
// (dealer brief §21/§64). Dealer onboarding + management is web-only; the
// customer-facing discovery views here work on both platforms.
//
// Hard rule reflected in the type split below: a *customer-facing* view
// (DealerCardView / DealerProfileView / DealerSearchResponse) never carries
// payment state, owner identity, raw prices the dealer chose not to publish, or
// any other private dealer data (brief §42/§51/§64). The dealer-facing owner
// views (DealerView / DealerSubscriptionView / DealerAnalyticsView) are only
// ever returned from the JWT-guarded, ownership-checked portal endpoints.

import type { MoneyView, PaymentProvider, SubscriptionStatus } from './dto';

// ---------------------------------------------------------------------------
// Taxonomy — reused by the search engine, so kept small and stable (brief §4).

export const DEALER_TYPES = [
  'restaurant',
  'food_shop',
  'african_food_store',
  'grocery_dealer',
  'food_distributor',
  'caterer',
  'bakery',
  'butcher',
  'market_vendor',
  'other',
] as const;
export type DealerType = (typeof DEALER_TYPES)[number];

export const DEALER_TYPE_LABELS: Record<DealerType, string> = {
  restaurant: 'Restaurant',
  food_shop: 'Food shop',
  african_food_store: 'African food store',
  grocery_dealer: 'Grocery dealer',
  food_distributor: 'Food distributor',
  caterer: 'Caterer',
  bakery: 'Bakery',
  butcher: 'Butcher',
  market_vendor: 'Market / vendor',
  other: 'Other food business',
};

export const DEALER_SERVICE_TYPES = [
  'shop',
  'delivery',
  'collection',
  'wholesale',
  'catering',
] as const;
export type DealerServiceType = (typeof DEALER_SERVICE_TYPES)[number];

export const DEALER_SERVICE_TYPE_LABELS: Record<DealerServiceType, string> = {
  shop: 'In-store',
  delivery: 'Delivery',
  collection: 'Click & collect',
  wholesale: 'Wholesale / distribution',
  catering: 'Catering',
};

// ---------------------------------------------------------------------------
// Lifecycle

// Moderation + approval lifecycle of the listing (admin-approval-before-payment
// business rule, 2026-09-11 — payment must NEVER happen before FoodPadi has
// approved the application). The *effective* customer visibility is still just
// (listingStatus === 'active' && subscription active) — see
// DealerView.isLiveToCustomers — but 'active' is now ONLY reachable from
// 'approved' (or 'expired', on renewal): a dealer can never buy their way past
// admin review, because DealerSearchProfileService.rebuild (the one writer of
// this field) refuses every other transition regardless of payment state.
//
//   draft              → being built in the onboarding wizard, never submitted
//   pending_review     → submitted, awaiting admin review — NOT payable
//   changes_requested  → admin asked for edits before it can be approved — NOT payable
//   approved           → admin approved the application, but NOT YET SUBSCRIBED —
//                        this is the new "payable, not yet live" state (brief §8)
//   active             → approved AND subscription active — live, searchable
//   rejected           → admin declined the application — NOT payable. Not
//                        permanently terminal: correcting the profile and
//                        resending (DealerPortalService.submit) puts the
//                        dealer back in pending_review, same as
//                        changes_requested (user instruction, 2026-09-15) —
//                        there is no separate "appeal" flow or duplicate row
//   suspended          → pulled by admin after being live (spam / report upheld)
//   expired            // subscription lapsed past the grace window — removed
//                         from customer search (brief §25); renewing restores
//                         'active' with no re-approval needed
export type DealerListingStatus =
  | 'draft'
  | 'pending_review'
  | 'changes_requested'
  | 'approved'
  | 'active'
  | 'rejected'
  | 'suspended'
  | 'expired';

/** Listing statuses from which a dealer is allowed to start a subscription
    checkout — i.e. admin has approved them at least once. Enforced server-side
    in DealerPortalService.createCheckout, never just hidden in the UI. */
export const DEALER_PAYABLE_STATUSES: DealerListingStatus[] = ['approved', 'active', 'expired'];

// A paid subscription does NOT imply verification (brief §23). Only a completed
// FoodPadi verification process sets 'verified' + shows the badge.
export type DealerVerificationStatus = 'unverified' | 'verified';

// Dealer subscription status mirrors the Premium model's Stripe-verbatim status
// set exactly (packages/shared/src/dto.ts SubscriptionStatus).
export type DealerSubscriptionStatus = SubscriptionStatus;

// ---------------------------------------------------------------------------
// Customer-facing views

export interface DealerLocationView {
  label: string | null;
  locality: string;
  city: string | null;
  region: string | null;
  postcode: string | null;
  countryCode: string;
  latitude: number | null;
  longitude: number | null;
  isPrimary: boolean;
  /** Extra localities this location serves beyond its physical site (brief §31). */
  serviceAreas: string[];
}

export interface DealerProductView {
  name: string;
  category: string | null;
  description: string | null;
  imageUrl: string | null;
  available: boolean;
  /** Pre-formatted (e.g. "£3.50 / bottle"), present only when the dealer chose
      to publish a price — a hidden price is simply null here (brief §18). */
  priceText: string | null;
}

export interface DealerContactView {
  phone: string | null;
  websiteUrl: string | null;
  orderUrl: string | null;
  /** A ready-to-use https://wa.me/... link, or null. Built from the dealer's
      supplied WhatsApp number — never fabricated (brief §27). */
  whatsappUrl: string | null;
}

export interface DealerCardView {
  id: string;
  slug: string;
  name: string;
  dealerType: DealerType;
  categories: string[];
  cuisines: string[];
  primaryLocality: string | null;
  /** Only set when the search supplied a lat/lng origin; null for a plain
      locality search. */
  distanceMiles: number | null;
  isVerified: boolean;
  /** True only when this card is being shown in a paid Featured/Sponsored slot —
      the client labels it "Sponsored"/"Featured" (brief §11/§38). */
  isSponsored: boolean;
  /** Up to ~3 of the dealer's own products/keywords that matched the query,
      shown as chips so the customer can see WHY this dealer is relevant. */
  matchedTerms: string[];
  /** 0–1, rounded to 2dp. Diagnostic/analytics only — never shown to customers. */
  relevanceScore: number;
  /** Post-visit customer ratings (user instruction 2026-09-11). null average =
      no ratings yet — never shown as "0 stars". */
  ratingAverage: number | null;
  ratingCount: number;
}

export interface DealerProfileView extends DealerCardView {
  description: string | null;
  /** Free-form { mon: "09:00–18:00", ... }; shown as-is, never parsed into an
      "open now" claim on the client (brief §27, same posture as local-food-search). */
  openingHours: Record<string, string> | null;
  contact: DealerContactView;
  locations: DealerLocationView[];
  serviceAreas: string[];
  products: DealerProductView[];
  serviceType: DealerServiceType[];
  dietaryTags: string[];
  /** True iff FoodPadi has completed its verification process for this dealer. */
  isVerified: boolean;
}

// ---------------------------------------------------------------------------
// Customer search

export interface DealerSearchRequest {
  /** Free-text: product / category / cuisine / business name, optionally with a
      locality token ("egusi leicester"). */
  q?: string;
  /** Explicit locality (town/city) — used when the client already knows it
      (e.g. from a "near <place>" search) instead of a lat/lng. */
  locality?: string;
  latitude?: number;
  longitude?: number;
  category?: string;
  dealerType?: DealerType;
  /** 1-based. */
  page?: number;
}

export interface DealerSearchResponse {
  query: string;
  locality: string | null;
  /** Paid Featured/Sponsored slots — max 3, each still satisfies the relevance
      + locality floors (brief §12/§37/§81). Never a superset of `results`. */
  featured: DealerCardView[];
  /** Organic matches, ranked by relevance + locality + quality (brief §10). */
  results: DealerCardView[];
  page: number;
  pageSize: number;
  hasMore: boolean;
  /** True when the FoodPadi dealer network has ANY active dealer for this
      area/query — lets the client decide between "no strong match" and "no
      dealers here yet" copy. When false the client should simply fall back to
      the existing local (OSM) discovery with no dealer section (brief §60/§82). */
  networkHasCoverage: boolean;
}

// ---------------------------------------------------------------------------
// Dealer-facing (owner) views + requests — portal only, JWT + ownership guarded.

export interface DealerOwnerProductView extends DealerProductView {
  id: string;
  /** Raw minor units, owner-only (customers get the formatted priceText). */
  pricePence: number | null;
  unit: string | null;
}

export interface DealerView {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  dealerType: DealerType;
  phone: string | null;
  websiteUrl: string | null;
  orderUrl: string | null;
  whatsapp: string | null;
  openingHours: Record<string, string> | null;
  categories: string[];
  cuisines: string[];
  productKeywords: string[];
  dietaryTags: string[];
  serviceType: DealerServiceType[];
  listingStatus: DealerListingStatus;
  /** Admin's message for a 'changes_requested' or 'rejected' application —
      null otherwise, and cleared automatically on resubmission. */
  approvalNote: string | null;
  verificationStatus: DealerVerificationStatus;
  profileCompleteness: number; // 0–100
  /** listingStatus === 'active' && the subscription is active. */
  isLiveToCustomers: boolean;
  /** isLiveToCustomers && profileCompleteness >= the Featured threshold. */
  featuredEligible: boolean;
  /** Post-visit customer ratings — null average = no ratings yet. */
  ratingAverage: number | null;
  ratingCount: number;
  createdAt: string; // ISO
  submittedAt: string | null;
  activatedAt: string | null;
  locations: DealerOwnerLocationView[];
  products: DealerOwnerProductView[];
}

export interface DealerOwnerLocationView extends DealerLocationView {
  id: string;
  addressLine: string | null;
  serviceRadiusMiles: number | null;
}

export interface CreateDealerRequest {
  name: string;
  dealerType: DealerType;
}

export interface UpdateDealerRequest {
  name?: string;
  description?: string | null;
  dealerType?: DealerType;
  phone?: string | null;
  websiteUrl?: string | null;
  orderUrl?: string | null;
  whatsapp?: string | null;
  openingHours?: Record<string, string> | null;
  categories?: string[];
  cuisines?: string[];
  productKeywords?: string[];
  dietaryTags?: string[];
  serviceType?: DealerServiceType[];
}

export interface DealerLocationInput {
  label?: string | null;
  addressLine?: string | null;
  locality: string;
  city?: string | null;
  region?: string | null;
  postcode?: string | null;
  countryCode?: string;
  latitude?: number | null;
  longitude?: number | null;
  isPrimary?: boolean;
  serviceAreas?: string[];
  serviceRadiusMiles?: number | null;
}

export interface DealerProductInput {
  name: string;
  category?: string | null;
  description?: string | null;
  /** A pasted external https:// link. Omit to leave the stored image
      untouched; '' or null to remove it. Mutually exclusive with
      imageDataUrl — setting one clears the other. */
  imageUrl?: string | null;
  /** An uploaded photo as a base64 data URL, resized server-side and stored
      as binary — see DealerProductDto.imageDataUrl on the API. Omit to leave
      the stored image untouched; null to remove it. */
  imageDataUrl?: string | null;
  available?: boolean;
  pricePence?: number | null;
  unit?: string | null;
}

export interface DealerSubmitResponse {
  dealer: DealerView;
  /** Human-readable list of what still blocks the listing going live
      (empty ⇒ submitted for review / activated). */
  missing: string[];
}

// ---------------------------------------------------------------------------
// Dealer subscription (owner-facing) — a SEPARATE product from FoodPadi Premium;
// never shares the `subscriptions` row (brief §13). Simple flat price, no FX
// estimate engine, no per-currency options (brief §44/§45 "keep pricing simple").

export interface DealerSubscriptionView {
  status: DealerSubscriptionStatus;
  /** The single "is this dealer paid-up" answer — includes the past_due grace window. */
  active: boolean;
  provider: PaymentProvider;
  plan: string; // 'dealer_monthly'
  price: MoneyView; // canonical price (e.g. { amountCents: 2900, currency: 'usd' })
  presentment: MoneyView | null; // what the provider actually charged, once paid
  billingInterval: string;
  currentPeriodEnd: string | null; // ISO
  cancelAtPeriodEnd: boolean;
  canceledAt: string | null; // ISO
  trialEndsAt: string | null; // ISO
  /** Stripe billing portal available (real Stripe subs). */
  canManage: boolean;
  /** Cancellable in-app (Flutterwave / demo Stripe). */
  canCancel: boolean;
}

export interface DealerCheckoutResponse {
  url: string;
  provider: PaymentProvider;
}

export interface DealerCheckoutSyncRequest {
  provider?: PaymentProvider;
  /** Stripe Checkout Session id from the redirect. */
  sessionId?: string;
  /** Flutterwave: our generated ref + Flutterwave's transaction id, from the redirect. */
  txRef?: string;
  transactionId?: string;
}

export interface DealerCheckoutSyncResponse {
  subscription: DealerSubscriptionView;
  /** True when this sync is what flipped the dealer to active (for the activation screen). */
  justActivated: boolean;
}

// ---------------------------------------------------------------------------
// Analytics — aggregate only, never customer PII (brief §42/§43/§55).

export const DEALER_EVENT_TYPES = [
  'search_appearance',
  'featured_impression',
  'profile_view',
  'website_click',
  'phone_click',
  'direction_click',
  'order_click',
] as const;
export type DealerEventType = (typeof DEALER_EVENT_TYPES)[number];

// The subset a customer client is allowed to report directly (the rest are
// recorded server-side when the search engine actually shows a dealer).
export const DEALER_CLIENT_EVENT_TYPES = [
  'profile_view',
  'website_click',
  'phone_click',
  'direction_click',
  'order_click',
] as const;
export type DealerClientEventType = (typeof DEALER_CLIENT_EVENT_TYPES)[number];

export interface RecordDealerEventRequest {
  type: DealerClientEventType;
}

export interface DealerAnalyticsView {
  rangeDays: number;
  searchAppearances: number;
  featuredImpressions: number;
  profileViews: number;
  websiteClicks: number;
  phoneClicks: number;
  directionClicks: number;
  orderClicks: number;
  /** Most common search terms this dealer appeared for — the raw `query` string,
      never tied to any user (brief §16/§42). */
  topSearches: { query: string; count: number }[];
  profileCompleteness: number;
}

// ---------------------------------------------------------------------------
// Customer reporting (brief §40) — deliberately minimal, no reviews/social (§41).

export const DEALER_REPORT_REASONS = [
  'wrong_business',
  'closed',
  'incorrect_info',
  'inappropriate',
] as const;
export type DealerReportReason = (typeof DEALER_REPORT_REASONS)[number];

export interface DealerReportRequest {
  reason: DealerReportReason;
  detail?: string;
}

// ---------------------------------------------------------------------------
// Post-visit customer ratings (user instruction 2026-09-11). Deliberately
// narrow — one star rating + an optional short comment per customer per
// dealer, no likes/follows/threads (still not the social review network the
// original brief §41/§78 ruled out of MVP). Account-only; no guest ratings.
// A rater's identity is never exposed to other customers or the dealer
// (brief §42) — the list shows a generic label, never a name/email.

export const DEALER_RATING_MIN = 1;
export const DEALER_RATING_MAX = 5;
/** A dealer needs at least this many ratings before they blend into ranking
    (brief §56 — one troll/plant review must not swing a listing). */
export const DEALER_RATING_MIN_FOR_RANKING = 3;

export interface DealerRatingView {
  id: string;
  rating: number;
  comment: string | null;
  createdAt: string;
  updatedAt: string;
  /** true only for the entry belonging to the caller — lets the client show
      "Your rating" / offer edit-delete without identifying anyone else. */
  isMine: boolean;
}

export interface DealerRatingsResponse {
  average: number | null;
  count: number;
  ratings: DealerRatingView[];
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export interface SubmitDealerRatingRequest {
  rating: number;
  comment?: string;
}

// ---------------------------------------------------------------------------
// Shared constants

/** Minimum profileCompleteness for Featured/Sponsored eligibility (brief §17). */
export const DEALER_FEATURED_MIN_COMPLETENESS = 70;
/** Max Featured slots per search (brief §12). */
export const DEALER_FEATURED_SLOTS = 3;

// ---------------------------------------------------------------------------
// Admin console (dealer brief §39/§40/§68) — served only from the staff-auth'd
// /admin area, never to a dealer or customer.

/** Application-queue counts for the admin Food Dealer overview strip. */
export interface AdminDealerOverview {
  draft: number;
  pendingReview: number;
  changesRequested: number;
  /** Approved by admin but not yet subscribed — the new state this business
      rule introduces. */
  approvedUnpaid: number;
  active: number;
  rejected: number;
  suspended: number;
  expired: number;
}

/** One entry in a dealer's approval/lifecycle audit trail (brief §17). Admin
    identity is intentionally NOT included here yet (AdminApiGuard doesn't
    carry a per-staff id through to this layer — same posture as the existing
    `verifiedBy` field, which is also always null today). */
export interface DealerAuditEntry {
  action: string; // submitted | resubmitted | changes_requested | approved | rejected | suspended | reactivated | activated | verified | unverified
  previousStatus: string | null;
  newStatus: string | null;
  reason: string | null;
  createdAt: string;
}

export interface AdminDealerListItem {
  id: string;
  slug: string;
  name: string;
  ownerEmail: string;
  dealerType: DealerType;
  listingStatus: DealerListingStatus;
  verificationStatus: DealerVerificationStatus;
  subscriptionStatus: DealerSubscriptionStatus;
  subscriptionActive: boolean;
  isLiveToCustomers: boolean;
  profileCompleteness: number;
  primaryLocality: string | null;
  openReports: number;
  ratingAverage: number | null;
  ratingCount: number;
  createdAt: string;
  submittedAt: string | null;
}

export interface AdminDealerListResponse {
  items: AdminDealerListItem[];
  total: number;
  page: number;
  pageSize: number;
}

export interface AdminDealerReportView {
  id: string;
  reason: DealerReportReason;
  detail: string | null;
  status: string; // 'open' | 'reviewed' | 'actioned' | 'dismissed'
  createdAt: string;
  reviewedAt: string | null;
}

export interface AdminDealerDetail extends AdminDealerListItem {
  description: string | null;
  categories: string[];
  cuisines: string[];
  productKeywords: string[];
  dietaryTags: string[];
  phone: string | null;
  websiteUrl: string | null;
  orderUrl: string | null;
  whatsapp: string | null;
  openingHours: Record<string, string> | null;
  featuredEligible: boolean;
  /** Admin's message on the current changes_requested/rejected decision. */
  approvalNote: string | null;
  activatedAt: string | null;
  locations: DealerOwnerLocationView[];
  products: DealerOwnerProductView[];
  reports: AdminDealerReportView[];
  ratings: AdminDealerRatingView[];
  /** Full approval/lifecycle history, oldest first (brief §17). */
  auditLog: DealerAuditEntry[];
}

export interface AdminDealerRatingView {
  id: string;
  rating: number;
  comment: string | null;
  hidden: boolean;
  createdAt: string;
}

export type AdminDealerAction =
  | 'approve' // pending_review → approved (admin-approval-before-payment: NOT active — the dealer still has to subscribe)
  | 'reject' // pending_review / changes_requested → rejected (not permanently terminal — the dealer can correct their profile and resend for review; requires `note`)
  | 'request_changes' // pending_review → changes_requested (requires `note` telling the dealer what to fix)
  | 'suspend' // any → suspended (removed from customer search)
  | 'reactivate' // suspended / expired → active
  | 'verify' // set verificationStatus = 'verified' (brief §23: a real check, not "they paid")
  | 'unverify';

export interface AdminDealerActionRequest {
  action: AdminDealerAction;
  /** Required for 'reject' and 'request_changes' — shown to the dealer verbatim. */
  note?: string;
}

export interface AdminUpdateDealerReportRequest {
  status: 'reviewed' | 'actioned' | 'dismissed';
}
