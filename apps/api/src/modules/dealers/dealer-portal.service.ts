import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DEALER_PAYABLE_STATUSES } from '@foodpadi/shared';
import type {
  DealerAnalyticsView,
  DealerCheckoutResponse,
  DealerCheckoutSyncRequest,
  DealerCheckoutSyncResponse,
  DealerProfileView,
  DealerSubmitResponse,
  DealerSubscriptionView,
  DealerView,
  PaymentProvider,
} from '@foodpadi/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { DealerEntitlementService } from './dealer-entitlement.service';
import { DealerSearchProfileService } from './dealer-search-profile.service';
import { DealerSubscriptionService } from './dealer-subscription.service';
import { DealerAuditService } from './dealer-audit.service';
import { dealerMissingFields } from './dealer-completeness';
import { DEALER_LIMITS, singularise, slugifyName, tokenise } from './dealer-taxonomy';
import { toDealerProfileView, toDealerView, type DealerWithChildren } from './dealer-view';
import { resizeRemoteProductImage, resizeUploadedProductImage } from './product-image.util';
import { CreateDealerDto } from './dto/create-dealer.dto';
import { UpdateDealerDto } from './dto/update-dealer.dto';
import { DealerLocationDto } from './dto/dealer-location.dto';
import { DealerProductDto } from './dto/dealer-product.dto';

const CHILDREN = { locations: true, products: true } as const;
const ANALYTICS_WINDOW_DAYS = 30;

/**
 * The dealer-facing management surface (dealer brief §15/§49). Every method is
 * scoped to the caller's own dealer via `ownedDealer(userId)`; a body/param
 * dealerId is never trusted (brief §52). Every write ends with a
 * DealerSearchProfileService rebuild so the customer search index never lags
 * the portal.
 *
 * Admin-approval-before-payment (2026-09-11): `submit()` only ever lands a
 * dealer in `pending_review` — there is no auto-approve path any more. Only
 * AdminDealersService can move a dealer to `approved`, and `createCheckout`
 * below is the payment endpoint's own server-side gate (brief §22): it refuses
 * to start a checkout unless the dealer has already been approved at least
 * once, regardless of what the UI shows.
 */
@Injectable()
export class DealerPortalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly entitlement: DealerEntitlementService,
    private readonly searchProfile: DealerSearchProfileService,
    private readonly subscriptions: DealerSubscriptionService,
    private readonly audit: DealerAuditService,
  ) {}

  // --------------------------------------------------------------------------
  // Ownership
  // --------------------------------------------------------------------------

  private async ownedDealer(userId: string): Promise<DealerWithChildren> {
    const dealer = await this.prisma.dealer.findFirst({
      where: { ownerUserId: userId, deletedAt: null },
      include: CHILDREN,
    });
    if (!dealer) {
      throw new NotFoundException({
        message: 'You have not created a Food Dealer profile yet.',
        code: 'no_dealer',
      });
    }
    return dealer as DealerWithChildren;
  }

  private async view(dealer: DealerWithChildren): Promise<DealerView> {
    const active = await this.entitlement.isActive(dealer.id);
    return toDealerView(dealer, active);
  }

  // --------------------------------------------------------------------------
  // Dealer profile
  // --------------------------------------------------------------------------

  async getMine(userId: string): Promise<DealerView> {
    return this.view(await this.ownedDealer(userId));
  }

  async create(userId: string, dto: CreateDealerDto): Promise<DealerView> {
    const existing = await this.prisma.dealer.findFirst({
      where: { ownerUserId: userId, deletedAt: null },
    });
    if (existing) {
      throw new ConflictException({
        message: 'This account already manages a Food Dealer profile.',
        code: 'dealer_exists',
      });
    }
    const slug = await this.uniqueSlug(dto.name, null);
    const dealer = await this.prisma.dealer.create({
      data: {
        ownerUserId: userId,
        slug,
        name: dto.name.trim(),
        dealerType: dto.dealerType,
        listingStatus: 'draft',
      },
      include: CHILDREN,
    });
    await this.searchProfile.rebuild(dealer.id);
    return this.view(dealer as DealerWithChildren);
  }

  async update(userId: string, dto: UpdateDealerDto): Promise<DealerView> {
    const dealer = await this.ownedDealer(userId);
    // The slug is stable once created (customer links + SEO depend on it) — a
    // name change never re-slugs.
    const data: Record<string, unknown> = {};
    if (dto.name !== undefined) data.name = dto.name.trim();
    if (dto.description !== undefined) data.description = emptyToNull(dto.description);
    if (dto.dealerType !== undefined) data.dealerType = dto.dealerType;
    if (dto.phone !== undefined) data.phone = emptyToNull(dto.phone);
    if (dto.websiteUrl !== undefined) data.websiteUrl = normaliseUrl(dto.websiteUrl);
    if (dto.orderUrl !== undefined) data.orderUrl = normaliseUrl(dto.orderUrl);
    if (dto.whatsapp !== undefined) data.whatsapp = emptyToNull(dto.whatsapp);
    if (dto.openingHours !== undefined) data.openingHours = dto.openingHours ?? undefined;
    if (dto.categories !== undefined) data.categories = cleanList(dto.categories, DEALER_LIMITS.categories);
    if (dto.cuisines !== undefined) data.cuisines = cleanList(dto.cuisines, DEALER_LIMITS.cuisines);
    if (dto.productKeywords !== undefined) {
      data.productKeywords = cleanList(dto.productKeywords, DEALER_LIMITS.productKeywords);
    }
    if (dto.dietaryTags !== undefined) data.dietaryTags = cleanList(dto.dietaryTags, 30);
    if (dto.serviceType !== undefined) data.serviceType = [...new Set(dto.serviceType)];

    await this.prisma.dealer.update({ where: { id: dealer.id }, data });
    await this.searchProfile.rebuild(dealer.id);
    return this.view(await this.ownedDealer(userId));
  }

  // --------------------------------------------------------------------------
  // Locations
  // --------------------------------------------------------------------------

  async addLocation(userId: string, dto: DealerLocationDto): Promise<DealerView> {
    const dealer = await this.ownedDealer(userId);
    if (dealer.locations.length >= DEALER_LIMITS.locations) {
      throw new BadRequestException(`A dealer can have at most ${DEALER_LIMITS.locations} locations.`);
    }
    const isPrimary = dto.isPrimary || dealer.locations.length === 0;
    if (isPrimary) {
      await this.prisma.dealerLocation.updateMany({
        where: { dealerId: dealer.id },
        data: { isPrimary: false },
      });
    }
    await this.prisma.dealerLocation.create({
      data: { dealerId: dealer.id, ...locationData(dto), isPrimary },
    });
    await this.searchProfile.rebuild(dealer.id);
    return this.view(await this.ownedDealer(userId));
  }

  async updateLocation(userId: string, locationId: string, dto: DealerLocationDto): Promise<DealerView> {
    const dealer = await this.ownedDealer(userId);
    const location = dealer.locations.find((l) => l.id === locationId);
    if (!location) throw new NotFoundException('Location not found.');
    if (dto.isPrimary) {
      await this.prisma.dealerLocation.updateMany({
        where: { dealerId: dealer.id },
        data: { isPrimary: false },
      });
    }
    await this.prisma.dealerLocation.update({
      where: { id: locationId },
      data: { ...locationData(dto), ...(dto.isPrimary !== undefined ? { isPrimary: dto.isPrimary } : {}) },
    });
    await this.ensureOnePrimaryLocation(dealer.id);
    await this.searchProfile.rebuild(dealer.id);
    return this.view(await this.ownedDealer(userId));
  }

  async removeLocation(userId: string, locationId: string): Promise<DealerView> {
    const dealer = await this.ownedDealer(userId);
    if (!dealer.locations.some((l) => l.id === locationId)) {
      throw new NotFoundException('Location not found.');
    }
    await this.prisma.dealerLocation.delete({ where: { id: locationId } });
    await this.ensureOnePrimaryLocation(dealer.id);
    await this.searchProfile.rebuild(dealer.id);
    return this.view(await this.ownedDealer(userId));
  }

  private async ensureOnePrimaryLocation(dealerId: string): Promise<void> {
    const locations = await this.prisma.dealerLocation.findMany({
      where: { dealerId },
      orderBy: { createdAt: 'asc' },
    });
    if (locations.length === 0 || locations.some((l) => l.isPrimary)) return;
    await this.prisma.dealerLocation.update({
      where: { id: locations[0].id },
      data: { isPrimary: true },
    });
  }

  // --------------------------------------------------------------------------
  // Products
  // --------------------------------------------------------------------------

  async addProduct(userId: string, dto: DealerProductDto): Promise<DealerView> {
    const dealer = await this.ownedDealer(userId);
    const count = await this.prisma.dealerProduct.count({ where: { dealerId: dealer.id } });
    if (count >= DEALER_LIMITS.products) {
      throw new BadRequestException(`A dealer can list at most ${DEALER_LIMITS.products} products.`);
    }
    await this.prisma.dealerProduct.create({
      data: { dealerId: dealer.id, ...(await productData(dto)) },
    });
    await this.searchProfile.rebuild(dealer.id);
    return this.view(await this.ownedDealer(userId));
  }

  async updateProduct(userId: string, productId: string, dto: DealerProductDto): Promise<DealerView> {
    const dealer = await this.ownedDealer(userId);
    if (!dealer.products.some((p) => p.id === productId)) {
      throw new NotFoundException('Product not found.');
    }
    await this.prisma.dealerProduct.update({ where: { id: productId }, data: await productData(dto) });
    await this.searchProfile.rebuild(dealer.id);
    return this.view(await this.ownedDealer(userId));
  }

  async removeProduct(userId: string, productId: string): Promise<DealerView> {
    const dealer = await this.ownedDealer(userId);
    if (!dealer.products.some((p) => p.id === productId)) {
      throw new NotFoundException('Product not found.');
    }
    await this.prisma.dealerProduct.delete({ where: { id: productId } });
    await this.searchProfile.rebuild(dealer.id);
    return this.view(await this.ownedDealer(userId));
  }

  // Copies a product row (including any uploaded image bytes) directly in the
  // DB — no base64 round-trip through the client needed, unlike a normal save.
  async duplicateProduct(userId: string, productId: string): Promise<DealerView> {
    const dealer = await this.ownedDealer(userId);
    const source = dealer.products.find((p) => p.id === productId);
    if (!source) {
      throw new NotFoundException('Product not found.');
    }
    const count = await this.prisma.dealerProduct.count({ where: { dealerId: dealer.id } });
    if (count >= DEALER_LIMITS.products) {
      throw new BadRequestException(`A dealer can list at most ${DEALER_LIMITS.products} products.`);
    }
    await this.prisma.dealerProduct.create({
      data: {
        dealerId: dealer.id,
        name: `${source.name} (copy)`,
        category: source.category,
        description: source.description,
        imageUrl: source.imageUrl,
        imageData: source.imageData,
        imageMimeType: source.imageMimeType,
        available: source.available,
        pricePence: source.pricePence,
        unit: source.unit,
        keywords: source.keywords,
      },
    });
    await this.searchProfile.rebuild(dealer.id);
    return this.view(await this.ownedDealer(userId));
  }

  // --------------------------------------------------------------------------
  // Submit / preview
  // --------------------------------------------------------------------------

  async getSubmitState(userId: string): Promise<DealerSubmitResponse> {
    const dealer = await this.ownedDealer(userId);
    const { hardMissing, softMissing } = this.missing(dealer);
    return { dealer: await this.view(dealer), missing: [...hardMissing, ...softMissing] };
  }

  /**
   * Submits (or re-submits after `changes_requested` OR `rejected`) the
   * application for admin review. Always lands back in `pending_review` —
   * never auto-approved, and never skips straight to a payable state
   * (admin-approval-before-payment, 2026-09-11). A rejection is not
   * permanently terminal: once the dealer has corrected whatever the
   * rejection reason called out, resending puts them back in the same review
   * queue as a fresh application — no separate "appeal" flow, no duplicate
   * dealer/application row (user instruction, 2026-09-15). A no-op for a
   * dealer already `pending_review`, and for any status beyond that
   * (`approved`/`active`/`suspended`/`expired`) there is nothing to
   * (re)submit, so the call just returns the current view.
   */
  async submit(userId: string): Promise<DealerSubmitResponse> {
    const dealer = await this.ownedDealer(userId);
    const { hardMissing, softMissing } = this.missing(dealer);
    if (hardMissing.length > 0) {
      throw new BadRequestException({
        message: 'Your profile is missing information customers need.',
        code: 'incomplete',
        missing: hardMissing,
      });
    }
    if (['draft', 'changes_requested', 'rejected', 'pending_review'].includes(dealer.listingStatus)) {
      const isResubmit = dealer.listingStatus === 'changes_requested' || dealer.listingStatus === 'rejected';
      await this.prisma.dealer.update({
        where: { id: dealer.id },
        data: {
          listingStatus: 'pending_review',
          submittedAt: dealer.submittedAt ?? new Date(),
          approvalNote: null, // the dealer just addressed it — clear the old admin note/reason
        },
      });
      if (dealer.listingStatus !== 'pending_review') {
        await this.audit.record({
          dealerId: dealer.id,
          action: isResubmit ? 'resubmitted' : 'submitted',
          previousStatus: dealer.listingStatus,
          newStatus: 'pending_review',
        });
      }
      await this.searchProfile.rebuild(dealer.id);
    }
    const refreshed = await this.ownedDealer(userId);
    return { dealer: await this.view(refreshed), missing: softMissing };
  }

  async getPreview(userId: string): Promise<DealerProfileView> {
    return toDealerProfileView(await this.ownedDealer(userId));
  }

  private missing(dealer: DealerWithChildren): { hardMissing: string[]; softMissing: string[] } {
    return dealerMissingFields({
      name: dealer.name,
      description: dealer.description,
      dealerType: dealer.dealerType,
      phone: dealer.phone,
      websiteUrl: dealer.websiteUrl,
      orderUrl: dealer.orderUrl,
      whatsapp: dealer.whatsapp,
      openingHours: dealer.openingHours,
      categories: dealer.categories,
      cuisines: dealer.cuisines,
      locationCount: dealer.locations.length,
      productCount: dealer.products.length,
    });
  }

  // --------------------------------------------------------------------------
  // Subscription (delegates to DealerSubscriptionService)
  // --------------------------------------------------------------------------

  async getSubscription(userId: string): Promise<DealerSubscriptionView> {
    const dealer = await this.ownedDealer(userId);
    return this.subscriptions.getView(dealer.id);
  }

  /**
   * The payment endpoint's own server-side gate (brief §22/§25) — enforced
   * here regardless of what the dealer dashboard UI shows or hides. A dealer
   * can only start a checkout once FoodPadi has approved their application at
   * least once (DEALER_PAYABLE_STATUSES: 'approved' | 'active' | 'expired' —
   * the latter two cover an already-subscribed dealer starting a fresh
   * checkout, e.g. after a card failure, and a renewal after lapsing).
   * `pending_review` / `changes_requested` / `rejected` / `suspended` /
   * `draft` are all refused, with no exceptions.
   */
  async createCheckout(
    userId: string,
    email: string,
    provider?: PaymentProvider,
  ): Promise<DealerCheckoutResponse> {
    const dealer = await this.ownedDealer(userId);
    if (!DEALER_PAYABLE_STATUSES.includes(dealer.listingStatus as (typeof DEALER_PAYABLE_STATUSES)[number])) {
      throw new ForbiddenException({
        message: 'Your Food Dealer application must be approved by FoodPadi before you can subscribe.',
        code: 'not_approved',
      });
    }
    return this.subscriptions.createCheckout(
      { dealerId: dealer.id, ownerUserId: userId, email, name: dealer.name },
      provider,
    );
  }

  async createPortal(userId: string): Promise<{ url: string }> {
    const dealer = await this.ownedDealer(userId);
    return this.subscriptions.createPortal(dealer.id);
  }

  async cancelSubscription(userId: string): Promise<DealerSubscriptionView> {
    const dealer = await this.ownedDealer(userId);
    return this.subscriptions.cancel(dealer.id);
  }

  async syncCheckout(
    userId: string,
    email: string,
    body: DealerCheckoutSyncRequest,
  ): Promise<DealerCheckoutSyncResponse> {
    const dealer = await this.ownedDealer(userId);
    return this.subscriptions.syncCheckoutSession(
      { dealerId: dealer.id, ownerUserId: userId, email, name: dealer.name },
      body,
    );
  }

  // --------------------------------------------------------------------------
  // Analytics (aggregate only — no customer PII, brief §16/§42/§43)
  // --------------------------------------------------------------------------

  async getAnalytics(userId: string): Promise<DealerAnalyticsView> {
    const dealer = await this.ownedDealer(userId);
    const since = new Date(Date.now() - ANALYTICS_WINDOW_DAYS * 86_400_000);
    const events = await this.prisma.dealerEvent.findMany({
      where: { dealerId: dealer.id, occurredAt: { gte: since } },
      select: { type: true, query: true },
    });

    const count = (t: string) => events.filter((e) => e.type === t).length;
    const queryTally = new Map<string, number>();
    for (const e of events) {
      if (e.type !== 'search_appearance' || !e.query) continue;
      queryTally.set(e.query, (queryTally.get(e.query) ?? 0) + 1);
    }
    const topSearches = [...queryTally.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([query, c]) => ({ query, count: c }));

    return {
      rangeDays: ANALYTICS_WINDOW_DAYS,
      searchAppearances: count('search_appearance'),
      featuredImpressions: count('featured_impression'),
      profileViews: count('profile_view'),
      websiteClicks: count('website_click'),
      phoneClicks: count('phone_click'),
      directionClicks: count('direction_click'),
      orderClicks: count('order_click'),
      topSearches,
      profileCompleteness: dealer.profileCompleteness,
    };
  }

  // --------------------------------------------------------------------------
  // Helpers
  // --------------------------------------------------------------------------

  private async uniqueSlug(name: string, localityHint: string | null): Promise<string> {
    const base = slugifyName(name);
    const candidates = [base];
    if (localityHint) candidates.push(`${base}-${slugifyName(localityHint)}`);
    for (const c of candidates) {
      if (!(await this.prisma.dealer.findUnique({ where: { slug: c } }))) return c;
    }
    for (let n = 2; n < 500; n++) {
      const c = `${base}-${n}`;
      if (!(await this.prisma.dealer.findUnique({ where: { slug: c } }))) return c;
    }
    return `${base}-${Date.now().toString(36)}`;
  }
}

function emptyToNull(v: string | null | undefined): string | null {
  const t = (v ?? '').trim();
  return t.length ? t : null;
}

// Accepts "example.com" or a full URL; stores a well-formed https URL or null.
// Never fabricates — an unparseable value becomes null rather than a guess.
function normaliseUrl(v: string | null | undefined): string | null {
  const t = emptyToNull(v);
  if (!t) return null;
  const withScheme = /^https?:\/\//i.test(t) ? t : `https://${t}`;
  try {
    const u = new URL(withScheme);
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.toString() : null;
  } catch {
    return null;
  }
}

function cleanList(list: string[], cap: number): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of list) {
    const t = raw.trim();
    const key = t.toLowerCase();
    if (t && !seen.has(key)) {
      seen.add(key);
      out.push(t);
    }
    if (out.length >= cap) break;
  }
  return out;
}

function locationData(dto: DealerLocationDto) {
  return {
    label: emptyToNull(dto.label),
    addressLine: emptyToNull(dto.addressLine),
    locality: dto.locality.trim(),
    city: emptyToNull(dto.city),
    region: emptyToNull(dto.region),
    postcode: emptyToNull(dto.postcode),
    countryCode: (dto.countryCode ?? 'GB').toUpperCase().slice(0, 2),
    latitude: dto.latitude ?? null,
    longitude: dto.longitude ?? null,
    serviceAreas: cleanList(dto.serviceAreas ?? [], DEALER_LIMITS.serviceAreasPerLocation),
    serviceRadiusMiles: dto.serviceRadiusMiles ?? null,
  };
}

async function productData(dto: DealerProductDto) {
  const name = dto.name.trim();
  // Seed searchable keywords from the product name + its category, so "jollof"
  // matches "Jollof Rice" without the dealer hand-listing synonyms (brief §36).
  const keywords = [
    ...new Set(
      [...tokenise(name), ...tokenise(dto.category ?? '')].flatMap((t) => [t, singularise(t)]),
    ),
  ];
  return {
    name,
    category: emptyToNull(dto.category),
    description: emptyToNull(dto.description),
    available: dto.available ?? true,
    pricePence: dto.pricePence ?? null,
    unit: emptyToNull(dto.unit),
    keywords,
    ...(await productImageData(dto)),
  };
}

// A product has at most one image, always our own re-encoded copy in
// imageData/imageMimeType — a pasted external link is fetched and resized
// through the same pipeline an upload goes through (never stored/hotlinked
// as a raw external URL), so "paste a link" and "upload a photo" both end up
// optimised and served identically from GET /dealers/products/:id/image.
// imageUrl itself is legacy/unused for new writes; kept in the return shape
// (always cleared) only because it's still a real column read elsewhere.
// Each of imageUrl/imageDataUrl independently supports three intents on the
// way in: key omitted (undefined) = leave the stored image untouched, an
// empty string/null = remove it, a real value = fetch/decode and set it.
type ProductImageData = Partial<{ imageUrl: string | null; imageData: Buffer | null; imageMimeType: string | null }>;

async function productImageData(dto: DealerProductDto): Promise<ProductImageData> {
  if (dto.imageDataUrl) {
    const { data, mimeType } = await resizeUploadedProductImage(dto.imageDataUrl);
    return { imageUrl: null, imageData: data, imageMimeType: mimeType };
  }
  if (dto.imageDataUrl === null) {
    return { imageUrl: null, imageData: null, imageMimeType: null };
  }
  if (dto.imageUrl) {
    const normalised = normaliseUrl(dto.imageUrl);
    if (normalised) {
      const { data, mimeType } = await resizeRemoteProductImage(normalised);
      return { imageUrl: null, imageData: data, imageMimeType: mimeType };
    }
  }
  if (dto.imageUrl === null || dto.imageUrl === '') {
    return { imageUrl: null, imageData: null, imageMimeType: null };
  }
  return {};
}
