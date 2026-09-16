import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { DealerProfileView, DealerCardView, DealerSearchResponse } from '@foodpadi/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { BillingConfigService } from '../billing/billing-config.service';
import { DealerEntitlementService } from './dealer-entitlement.service';
import { DealerSearchProfileService } from './dealer-search-profile.service';
import { isDealerOpenNow } from './dealer-open-hours';
import { normaliseTerm } from './dealer-taxonomy';
import { toDealerProfileView, type DealerWithChildren } from './dealer-view';
import {
  parseDealerQuery,
  rankDealers,
  type RankableDealer,
  type RankedDealer,
} from './dealer-ranking';
import { DealerSearchDto, DealerReportDto } from './dto/dealer-search.dto';

const PAGE_SIZE = 10;
// Upper bound on candidates ranked in memory. Well above the near-term dealer
// count; ordered by completeness so if it ever bites, the fullest listings win
// the cut (brief §74: server-side ranking, don't sort everything client-side).
const CANDIDATE_CAP = 400;

@Injectable()
export class DealerSearchService {
  private readonly logger = new Logger(DealerSearchService.name);
  private graceCache: { at: number; days: number } | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: BillingConfigService,
    private readonly entitlement: DealerEntitlementService,
    private readonly searchProfile: DealerSearchProfileService,
  ) {}

  // ------------------------------------------------------------------------
  // Customer search
  // ------------------------------------------------------------------------

  async search(dto: DealerSearchDto): Promise<DealerSearchResponse> {
    const page = Math.max(1, dto.page ?? 1);
    const graceDays = await this.resolveGraceDays();

    // 1. Pull candidates: active listing + (mirrored) active subscription. A
    //    token pre-filter on the denormalised searchText bounds the set when
    //    there's a query; a plain "dealers near me" browse loads all active.
    const rawTokens = normaliseTerm(dto.q ?? '')
      .split(' ')
      .filter((t) => t.length > 2);
    const rows = await this.prisma.dealerSearchProfile.findMany({
      where: {
        listingStatus: 'active',
        subscriptionActive: true,
        ...(rawTokens.length
          ? { OR: rawTokens.map((t) => ({ searchText: { contains: t } })) }
          : {}),
      },
      include: {
        dealer: { include: { locations: true, products: true, subscription: true } },
      },
      take: CANDIDATE_CAP,
      orderBy: { completeness: 'desc' },
    });

    // 2. Fresh entitlement check per candidate (pure, no I/O) — catches a
    //    subscription that lapsed past its grace window with no webhook since
    //    (brief §25 lazy expiry). Lapsed ones are dropped and their index row
    //    is rebuilt fire-and-forget so they stop matching next time.
    const live = rows.filter((row) => {
      const sub = (row.dealer as { subscription?: unknown }).subscription ?? null;
      const active = this.entitlement.computeEntitlement(sub as never, graceDays).active;
      if (!active) void this.searchProfile.rebuild(row.dealerId).catch(() => undefined);
      return active;
    });

    // 3. Parse the query, using the candidates' own localities as the gazetteer
    //    so "egusi leicester" splits into term + place correctly.
    const knownLocalities = new Set<string>();
    for (const r of live) for (const l of r.localities) knownLocalities.add(l);
    const q = parseDealerQuery(dto.q ?? '', {
      locality: dto.locality,
      latitude: dto.latitude,
      longitude: dto.longitude,
      category: dto.category,
      dealerType: dto.dealerType,
      knownLocalities,
    });

    // 4. Build rankables (+ dealerType filter) and rank.
    const now = new Date();
    const rankables: RankableDealer[] = live
      .filter((r) => !dto.dealerType || r.dealer.dealerType === dto.dealerType)
      .map((r) => this.toRankable(r, now));

    const { featured, organic } = rankDealers(rankables, q);

    // 5. Page the organic list; featured (max 3) rides on page 1 only.
    const start = (page - 1) * PAGE_SIZE;
    const pageOrganic = organic.slice(start, start + PAGE_SIZE);
    const shownFeatured = page === 1 ? featured : [];

    // 6. Coverage = the network has ANY live dealer for this locality/area,
    //    regardless of query relevance — lets the client pick "no strong match"
    //    vs "no dealers here yet" copy (and fall back to OSM discovery cleanly).
    const networkHasCoverage = this.hasAreaCoverage(rankables, q);

    // 7. Record aggregate discovery events (no customer PII — brief §42/§55).
    void this.recordAppearances(
      [...shownFeatured, ...pageOrganic],
      shownFeatured,
      dto.q ?? '',
      q.locality,
    );

    return {
      query: dto.q ?? '',
      locality: q.locality,
      featured: shownFeatured.map((r) => this.toCard(r)),
      results: pageOrganic.map((r) => this.toCard(r)),
      page,
      pageSize: PAGE_SIZE,
      hasMore: organic.length > start + PAGE_SIZE,
      networkHasCoverage,
    };
  }

  private toRankable(
    row: { dealerId: string; localities: string[]; primaryLat: number | null; primaryLng: number | null; completeness: number; featuredEligible: boolean; dealer: DealerWithChildren & { subscription?: unknown } },
    now: Date,
  ): RankableDealer {
    const d = row.dealer;
    return {
      id: d.id,
      slug: d.slug,
      dealerType: d.dealerType,
      name: d.name,
      products: d.products.map((p) => p.name),
      categories: d.categories,
      cuisines: d.cuisines,
      nameNorm: normaliseTerm(d.name),
      productsNorm: [
        ...d.products.map((p) => normaliseTerm(p.name)),
        ...d.productKeywords.map(normaliseTerm),
        ...d.products.flatMap((p) => (p.keywords ?? []).map(normaliseTerm)),
      ],
      categoriesNorm: d.categories.map(normaliseTerm),
      cuisinesNorm: d.cuisines.map(normaliseTerm),
      descriptionNorm: normaliseTerm(d.description ?? ''),
      localities: row.localities,
      primaryLat: row.primaryLat,
      primaryLng: row.primaryLng,
      completeness: row.completeness,
      featuredEligible: row.featuredEligible,
      isVerified: d.verificationStatus === 'verified',
      openNow: isDealerOpenNow(d.openingHours, now),
      ratingAverage: d.ratingAverage,
      ratingCount: d.ratingCount,
    };
  }

  private toCard(r: RankedDealer): DealerCardView {
    const d = r.dealer;
    return {
      id: d.id,
      slug: d.slug,
      name: d.name,
      dealerType: d.dealerType as DealerCardView['dealerType'],
      categories: d.categories,
      cuisines: d.cuisines,
      primaryLocality: d.localities[0] ? titleCase(d.localities[0]) : null,
      distanceMiles: r.distanceMiles,
      isVerified: d.isVerified,
      isSponsored: r.isSponsored,
      matchedTerms: r.matchedTerms,
      relevanceScore: r.relevance,
      ratingAverage: d.ratingAverage,
      ratingCount: d.ratingCount,
    };
  }

  private hasAreaCoverage(rankables: RankableDealer[], q: { locality: string | null; origin: { lat: number; lng: number } | null }): boolean {
    if (rankables.length === 0) return false;
    if (!q.locality && !q.origin) return true;
    return rankables.some((d) => {
      if (q.locality && d.localities.some((l) => l === q.locality || l.includes(q.locality!))) return true;
      if (q.origin && d.primaryLat != null && d.primaryLng != null) {
        const miles = haversine(q.origin, { lat: d.primaryLat, lng: d.primaryLng });
        return miles <= 25;
      }
      return false;
    });
  }

  private async recordAppearances(
    shown: RankedDealer[],
    featured: RankedDealer[],
    query: string,
    locality: string | null,
  ): Promise<void> {
    if (shown.length === 0) return;
    const featuredIds = new Set(featured.map((r) => r.dealer.id));
    const data = shown.flatMap((r) => {
      const base = { dealerId: r.dealer.id, query: query || null, locality };
      const rows = [{ ...base, type: 'search_appearance' }];
      if (featuredIds.has(r.dealer.id)) rows.push({ ...base, type: 'featured_impression' });
      return rows;
    });
    await this.prisma.dealerEvent.createMany({ data }).catch((e) => {
      this.logger.warn(`Could not record dealer appearances: ${String(e)}`);
    });
  }

  // ------------------------------------------------------------------------
  // Public dealer profile
  // ------------------------------------------------------------------------

  async getProductImage(productId: string): Promise<{ data: Buffer; mimeType: string } | null> {
    const product = await this.prisma.dealerProduct.findUnique({
      where: { id: productId },
      select: { imageData: true, imageMimeType: true },
    });
    if (!product?.imageData) return null;
    return { data: product.imageData, mimeType: product.imageMimeType ?? 'image/jpeg' };
  }

  async getPublicProfile(slug: string): Promise<DealerProfileView> {
    const dealer = await this.prisma.dealer.findUnique({
      where: { slug },
      include: { locations: true, products: true, subscription: true },
    });
    if (!dealer || dealer.deletedAt) throw this.gone();

    const graceDays = await this.resolveGraceDays();
    const active = this.entitlement.computeEntitlement(dealer.subscription, graceDays).active;
    if (dealer.listingStatus !== 'active' || !active) {
      if (!active && dealer.listingStatus === 'active') {
        void this.searchProfile.rebuild(dealer.id).catch(() => undefined);
      }
      throw this.gone();
    }

    void this.prisma.dealerEvent
      .create({ data: { dealerId: dealer.id, type: 'profile_view' } })
      .catch(() => undefined);

    return toDealerProfileView(dealer as DealerWithChildren, { isSponsored: false });
  }

  async recordEvent(slug: string, type: string): Promise<void> {
    const dealer = await this.prisma.dealer.findUnique({ where: { slug }, select: { id: true } });
    if (!dealer) throw this.gone();
    await this.prisma.dealerEvent.create({ data: { dealerId: dealer.id, type } });
  }

  async report(slug: string, dto: DealerReportDto, reporterUserId: string | null): Promise<void> {
    const dealer = await this.prisma.dealer.findUnique({ where: { slug }, select: { id: true } });
    if (!dealer) throw this.gone();
    await this.prisma.dealerReport.create({
      data: {
        dealerId: dealer.id,
        reporterUserId,
        reason: dto.reason,
        detail: dto.detail?.trim() || null,
      },
    });
  }

  // ------------------------------------------------------------------------

  private gone(): NotFoundException {
    return new NotFoundException({
      message: 'This dealer is no longer listed on FoodPadi.',
      code: 'not_listed',
    });
  }

  private async resolveGraceDays(): Promise<number> {
    const envRaw = process.env.DEALER_PAST_DUE_GRACE_DAYS ?? process.env.STRIPE_PAST_DUE_GRACE_DAYS;
    const fromEnv = envRaw ? Number.parseInt(envRaw, 10) : NaN;
    if (Number.isFinite(fromEnv) && fromEnv >= 0) return fromEnv;
    if (this.graceCache && Date.now() - this.graceCache.at < 30_000) return this.graceCache.days;
    const days = (await this.config.getResolved()).pastDueGraceDays;
    this.graceCache = { at: Date.now(), days };
    return days;
  }
}

function titleCase(s: string): string {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

function haversine(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const Rm = 3958.8;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return Rm * (2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h)));
}
