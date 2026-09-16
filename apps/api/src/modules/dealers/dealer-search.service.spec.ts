import { NotFoundException } from '@nestjs/common';
import { DealerSearchService } from './dealer-search.service';
import { DealerEntitlementService } from './dealer-entitlement.service';
import { DealerSearchProfileService } from './dealer-search-profile.service';
import { BillingConfigService } from '../billing/billing-config.service';
import { PrismaService } from '../../prisma/prisma.service';

// Build one search-profile row + its included dealer.
function profileRow(over: {
  id: string;
  name?: string;
  products?: string[];
  categories?: string[];
  localities?: string[];
  completeness?: number;
  featuredEligible?: boolean;
  listingStatus?: string;
  subscriptionActive?: boolean;
  subStatus?: string;
  currentPeriodEnd?: Date | null;
  primaryLat?: number | null;
  primaryLng?: number | null;
  verificationStatus?: string;
}) {
  const products = over.products ?? ['Egusi Soup'];
  return {
    dealerId: over.id,
    searchText: '',
    localities: over.localities ?? ['leicester'],
    categoriesNorm: [],
    productsNorm: [],
    cuisinesNorm: [],
    primaryLat: over.primaryLat ?? null,
    primaryLng: over.primaryLng ?? null,
    completeness: over.completeness ?? 85,
    featuredEligible: over.featuredEligible ?? false,
    listingStatus: over.listingStatus ?? 'active',
    subscriptionActive: over.subscriptionActive ?? true,
    lastBuiltAt: new Date(),
    dealer: {
      id: over.id,
      slug: over.id,
      name: over.name ?? over.id,
      dealerType: 'african_food_store',
      description: null,
      openingHours: null,
      categories: over.categories ?? ['Nigerian Food'],
      cuisines: ['Nigerian'],
      productKeywords: [],
      dietaryTags: [],
      serviceType: [],
      verificationStatus: over.verificationStatus ?? 'unverified',
      deletedAt: null,
      listingStatus: over.listingStatus ?? 'active',
      locations: (over.localities ?? ['leicester']).map((l, i) => ({
        id: `${over.id}-loc${i}`,
        locality: l,
        city: null,
        region: null,
        postcode: null,
        countryCode: 'GB',
        latitude: over.primaryLat ?? null,
        longitude: over.primaryLng ?? null,
        isPrimary: i === 0,
        serviceAreas: [],
        label: null,
      })),
      products: products.map((p, i) => ({
        id: `${over.id}-p${i}`,
        name: p,
        category: null,
        description: null,
        imageUrl: null,
        available: true,
        pricePence: null,
        unit: null,
        keywords: [],
      })),
      subscription: {
        id: `${over.id}-sub`,
        dealerId: over.id,
        provider: 'stripe',
        status: over.subStatus ?? 'active',
        cancelAtPeriodEnd: false,
        currentPeriodEnd:
          over.currentPeriodEnd === undefined
            ? new Date(Date.now() + 20 * 86_400_000)
            : over.currentPeriodEnd,
      },
    },
  };
}

function build(rows: ReturnType<typeof profileRow>[]) {
  const rebuild = jest.fn().mockResolvedValue(undefined);
  const createMany = jest.fn().mockResolvedValue({ count: 0 });
  const createEvent = jest.fn().mockResolvedValue({});

  const prisma: any = {
    dealerSearchProfile: {
      findMany: jest.fn(async ({ where }: any) =>
        rows.filter(
          (r) =>
            r.listingStatus === where.listingStatus &&
            r.subscriptionActive === where.subscriptionActive,
        ),
      ),
    },
    dealer: {
      findUnique: jest.fn(async ({ where }: any) => {
        const row = rows.find((r) => r.dealer.slug === where.slug || r.dealerId === where.id);
        if (!row) return null;
        return where.select ? { id: row.dealerId } : row.dealer;
      }),
    },
    dealerEvent: { createMany, create: createEvent },
    dealerReport: { create: jest.fn().mockResolvedValue({}) },
  };

  const entitlement = {
    computeEntitlement: DealerEntitlementService.prototype.computeEntitlement,
  } as unknown as DealerEntitlementService;
  const searchProfile = { rebuild } as unknown as DealerSearchProfileService;
  const config = {
    getResolved: jest.fn().mockResolvedValue({ pastDueGraceDays: 3 }),
  } as unknown as BillingConfigService;

  const svc = new DealerSearchService(
    prisma as unknown as PrismaService,
    config,
    entitlement,
    searchProfile,
  );
  return { svc, prisma, rebuild, createMany };
}

beforeEach(() => {
  delete process.env.DEALER_PAST_DUE_GRACE_DAYS;
  delete process.env.STRIPE_PAST_DUE_GRACE_DAYS;
});

describe('DealerSearchService.search', () => {
  it('no dealers at all → empty result, no coverage (client falls back to OSM discovery)', async () => {
    const { svc } = build([]);
    const res = await svc.search({ q: 'egusi', locality: 'Leicester' });
    expect(res.featured).toEqual([]);
    expect(res.results).toEqual([]);
    expect(res.networkHasCoverage).toBe(false);
  });

  it('relevant local dealer → returned; irrelevant one filtered out', async () => {
    const { svc } = build([
      profileRow({ id: 'mamas', products: ['Egusi Soup', 'Jollof Rice'] }),
      profileRow({ id: 'pizza', products: ['Margherita'], categories: ['Pizza'] }),
    ]);
    const res = await svc.search({ q: 'egusi leicester' });
    const ids = [...res.featured, ...res.results].map((c) => c.slug);
    expect(ids).toContain('mamas');
    expect(ids).not.toContain('pizza');
  });

  it('subscribed + eligible relevant dealer lands in the Featured section', async () => {
    const { svc } = build([
      profileRow({ id: 'mamas', featuredEligible: true, products: ['Egusi Soup'] }),
    ]);
    const res = await svc.search({ q: 'egusi', locality: 'Leicester' });
    expect(res.featured.map((c) => c.slug)).toEqual(['mamas']);
    expect(res.featured[0].isSponsored).toBe(true);
    expect(res.results).toEqual([]);
  });

  it('a dealer whose subscription has lapsed past grace is dropped AND its index row is rebuilt', async () => {
    const { svc, rebuild } = build([
      profileRow({
        id: 'lapsed',
        subStatus: 'past_due',
        currentPeriodEnd: new Date(Date.now() - 30 * 86_400_000),
        products: ['Egusi Soup'],
      }),
    ]);
    const res = await svc.search({ q: 'egusi', locality: 'Leicester' });
    expect([...res.featured, ...res.results]).toHaveLength(0);
    expect(rebuild).toHaveBeenCalledWith('lapsed');
  });

  it('paginates the organic results', async () => {
    const rows = Array.from({ length: 14 }, (_, i) =>
      profileRow({ id: `d${i}`, products: ['Egusi Soup'], completeness: 90 - i }),
    );
    const { svc } = build(rows);
    const p1 = await svc.search({ q: 'egusi leicester' });
    expect(p1.results).toHaveLength(10);
    expect(p1.hasMore).toBe(true);
    const p2 = await svc.search({ q: 'egusi leicester', page: 2 });
    expect(p2.results).toHaveLength(4);
    expect(p2.hasMore).toBe(false);
  });

  it('records a search_appearance per shown dealer and a featured_impression for Featured ones', async () => {
    const { svc, createMany } = build([
      profileRow({ id: 'feat', featuredEligible: true, products: ['Egusi Soup'] }),
      profileRow({ id: 'org', products: ['Egusi Soup'] }),
    ]);
    await svc.search({ q: 'egusi', locality: 'Leicester' });
    const data = createMany.mock.calls[0][0].data as { dealerId: string; type: string }[];
    expect(data.filter((d) => d.type === 'search_appearance').map((d) => d.dealerId).sort()).toEqual([
      'feat',
      'org',
    ]);
    expect(data.filter((d) => d.type === 'featured_impression').map((d) => d.dealerId)).toEqual(['feat']);
  });
});

describe('DealerSearchService.getPublicProfile', () => {
  it('active + subscribed → returns the profile view', async () => {
    const { svc } = build([profileRow({ id: 'mamas', name: "Mama's African Foods" })]);
    const view = await svc.getPublicProfile('mamas');
    expect(view.name).toBe("Mama's African Foods");
    expect(view.slug).toBe('mamas');
  });

  it('lapsed subscription → 404 (no longer listed) and rebuild fired', async () => {
    const { svc, rebuild } = build([
      profileRow({
        id: 'gone',
        subStatus: 'canceled',
        currentPeriodEnd: new Date(Date.now() - 86_400_000),
      }),
    ]);
    await expect(svc.getPublicProfile('gone')).rejects.toBeInstanceOf(NotFoundException);
    expect(rebuild).toHaveBeenCalledWith('gone');
  });

  it('unknown slug → 404', async () => {
    const { svc } = build([]);
    await expect(svc.getPublicProfile('nope')).rejects.toBeInstanceOf(NotFoundException);
  });
});
