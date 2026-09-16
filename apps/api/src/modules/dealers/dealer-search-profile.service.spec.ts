import { DealerSearchProfileService } from './dealer-search-profile.service';
import { DealerEntitlementService } from './dealer-entitlement.service';
import { DealerAuditService } from './dealer-audit.service';
import { PrismaService } from '../../prisma/prisma.service';

// The admin-approval-before-payment business rule (2026-09-11) lives entirely
// in DealerSearchProfileService.rebuild — it is the ONE writer of
// `listingStatus`, so this is the single most safety-critical test in the
// dealer surface: no matter what triggers a rebuild (webhook, checkout sync,
// portal edit, admin action), a dealer can only ever go `active` from
// `approved` or `expired` — never from `pending_review`, `changes_requested`,
// `rejected`, `suspended` or `draft`, even with a genuinely active
// subscription underneath.
function makeContext(dealerOverrides: Record<string, unknown>, subscriptionActive: boolean) {
  let dealer: any = {
    id: 'd1',
    deletedAt: null,
    name: 'X Foods',
    description: null,
    dealerType: 'restaurant',
    phone: null,
    websiteUrl: null,
    orderUrl: null,
    whatsapp: null,
    openingHours: null,
    categories: [],
    cuisines: [],
    productKeywords: [],
    dietaryTags: [],
    listingStatus: 'pending_review',
    profileCompleteness: 80,
    ratingAverage: null,
    ratingCount: 0,
    activatedAt: null,
    locations: [],
    products: [],
    ...dealerOverrides,
  };

  const upserts: any[] = [];
  const prisma: any = {
    dealer: {
      findUnique: jest.fn(async () => dealer),
      update: jest.fn(async ({ data }: any) => {
        dealer = { ...dealer, ...data };
        return dealer;
      }),
    },
    dealerSearchProfile: {
      upsert: jest.fn(async ({ create, update }: any) => {
        upserts.push({ create, update });
        return { ...create, ...update };
      }),
      delete: jest.fn(async () => ({})),
    },
    dealerAuditLog: { create: jest.fn(async ({ data }: any) => data) },
  };

  const entitlement = { isActive: jest.fn(async () => subscriptionActive) } as unknown as DealerEntitlementService;
  const audit = new DealerAuditService(prisma as unknown as PrismaService);
  const svc = new DealerSearchProfileService(prisma as unknown as PrismaService, entitlement, audit);
  return { svc, prisma, upserts, getDealer: () => dealer };
}

describe('DealerSearchProfileService.rebuild — activation gate', () => {
  it('approved + active subscription → activates (first activation), stamps activatedAt', async () => {
    const { svc, getDealer } = makeContext({ listingStatus: 'approved' }, true);
    await svc.rebuild('d1');
    expect(getDealer().listingStatus).toBe('active');
    expect(getDealer().activatedAt).not.toBeNull();
  });

  it('expired (previously approved+paid) + active subscription again → reactivates, no re-approval needed', async () => {
    const { svc, getDealer } = makeContext(
      { listingStatus: 'expired', activatedAt: new Date('2026-01-01') },
      true,
    );
    await svc.rebuild('d1');
    expect(getDealer().listingStatus).toBe('active');
    // Not a re-activation — the original activatedAt is untouched.
    expect(getDealer().activatedAt).toEqual(new Date('2026-01-01'));
  });

  it('active + subscription lapses → flips to expired (brief §25)', async () => {
    const { svc, getDealer } = makeContext({ listingStatus: 'active' }, false);
    await svc.rebuild('d1');
    expect(getDealer().listingStatus).toBe('expired');
  });

  // --- the critical negative cases: payment success must NEVER promote these ---
  it.each(['pending_review', 'changes_requested', 'rejected', 'suspended', 'draft'])(
    'listingStatus=%s + an ACTIVE subscription → still does NOT activate',
    async (status) => {
      const { svc, getDealer } = makeContext({ listingStatus: status }, true);
      await svc.rebuild('d1');
      expect(getDealer().listingStatus).toBe(status);
      expect(getDealer().activatedAt).toBeNull();
    },
  );

  it('featuredEligible in the search index requires listingStatus === active, not just approved+paid', async () => {
    // scoreDealerCompleteness recomputes from these fields on every rebuild —
    // profileCompleteness itself is just its last output, not an input — so
    // the fixture needs enough real fields to clear the 70% Featured floor.
    const { svc, upserts } = makeContext(
      {
        listingStatus: 'approved',
        description: 'Nigerian groceries in Leicester.',
        phone: '0116 555 0100',
        categories: ['African Food'],
        cuisines: ['Nigerian'],
        openingHours: { mon: '09:00-18:00' },
        locations: [{ id: 'l1', locality: 'Leicester', isPrimary: true, serviceAreas: [] }],
        products: [{ id: 'p1', name: 'Egusi Soup', keywords: [] }],
      },
      true,
    );
    await svc.rebuild('d1');
    const row = upserts[0].create ?? upserts[0].update;
    expect(row.listingStatus).toBe('active');
    expect(row.featuredEligible).toBe(true);
  });

  it('an audit entry is recorded when listingStatus actually transitions', async () => {
    const { svc, prisma } = makeContext({ listingStatus: 'approved' }, true);
    await svc.rebuild('d1');
    expect(prisma.dealerAuditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'activated', previousStatus: 'approved', newStatus: 'active' }),
      }),
    );
  });
});
