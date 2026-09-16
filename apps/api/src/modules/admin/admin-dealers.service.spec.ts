import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AdminDealersService } from './admin-dealers.service';
import { DealerEntitlementService } from '../dealers/dealer-entitlement.service';
import { DealerSearchProfileService } from '../dealers/dealer-search-profile.service';
import { DealerRatingService } from '../dealers/dealer-rating.service';
import { DealerAuditService } from '../dealers/dealer-audit.service';
import { MailerService } from '../../common/mailer.service';
import { PrismaService } from '../../prisma/prisma.service';

function makeContext(overrides: Partial<Record<string, unknown>> = {}) {
  const dealer: any = {
    id: 'd1',
    slug: 'mamas-african-foods',
    name: "Mama's African Foods",
    dealerType: 'african_food_store',
    description: null,
    categories: ['Nigerian Food'],
    cuisines: ['Nigerian'],
    productKeywords: [],
    dietaryTags: [],
    phone: '0116 555 0100',
    websiteUrl: null,
    orderUrl: null,
    whatsapp: null,
    openingHours: null,
    listingStatus: 'pending_review',
    verificationStatus: 'unverified',
    verifiedAt: null,
    profileCompleteness: 80,
    submittedAt: new Date(),
    activatedAt: null,
    createdAt: new Date(),
    deletedAt: null,
    ratingAverage: null,
    ratingCount: 0,
    owner: { email: 'owner@example.com' },
    subscription: { status: 'active', cancelAtPeriodEnd: false, currentPeriodEnd: new Date(Date.now() + 1e9) },
    locations: [{ id: 'l1', locality: 'Leicester', isPrimary: true, serviceAreas: [] }],
    products: [
      { id: 'p1', dealerId: 'd1', name: 'Egusi Soup', category: null, pricePence: null, unit: null, available: true },
    ],
    _count: { reports: 1 },
    ...overrides,
  };
  const reports: any[] = [
    { id: 'r1', dealerId: 'd1', reason: 'closed', detail: null, status: 'open', createdAt: new Date(), reviewedAt: null },
  ];

  const rebuild = jest.fn().mockResolvedValue(undefined);
  const prisma: any = {
    dealer: {
      findUnique: jest.fn(async () => dealer),
      findMany: jest.fn(async () => [dealer]),
      count: jest.fn(async () => 1),
      update: jest.fn(async ({ data }: any) => {
        Object.assign(dealer, data);
        return dealer;
      }),
    },
    dealerProduct: {
      findUnique: jest.fn(async ({ where }: any) => dealer.products.find((p: any) => p.id === where.id) ?? null),
      delete: jest.fn(async ({ where }: any) => {
        dealer.products = dealer.products.filter((p: any) => p.id !== where.id);
        return {};
      }),
    },
    dealerReport: {
      findMany: jest.fn(async () => reports),
      findUnique: jest.fn(async ({ where }: any) => reports.find((r) => r.id === where.id) ?? null),
      update: jest.fn(async ({ where, data }: any) => {
        const r = reports.find((x) => x.id === where.id);
        Object.assign(r, data);
        return r;
      }),
    },
    dealerAuditLog: {
      create: jest.fn(async ({ data }: any) => data),
      findMany: jest.fn(async () => []),
    },
  };

  const entitlement = {
    computeEntitlement: DealerEntitlementService.prototype.computeEntitlement,
  } as unknown as DealerEntitlementService;
  const searchProfile = { rebuild } as unknown as DealerSearchProfileService;
  const ratings = {
    listForAdmin: jest.fn().mockResolvedValue([]),
    setHidden: jest.fn().mockResolvedValue(undefined),
  } as unknown as DealerRatingService;
  const audit = new DealerAuditService(prisma as unknown as PrismaService);
  const mailer = { sendDealerApprovalStatusEmail: jest.fn().mockResolvedValue(undefined) } as unknown as MailerService;
  const svc = new AdminDealersService(
    prisma as unknown as PrismaService,
    entitlement,
    searchProfile,
    ratings,
    audit,
    mailer,
  );
  return { svc, prisma, dealer, reports, rebuild, ratings, mailer };
}

describe('AdminDealersService.act — admin-approval-before-payment', () => {
  it('approve: pending_review → approved (NOT active — the dealer still has to pay), search index rebuilt, dealer notified', async () => {
    const { svc, dealer, rebuild, mailer } = makeContext();
    const res = await svc.act('d1', { action: 'approve' });
    expect(dealer.listingStatus).toBe('approved');
    expect(res.listingStatus).toBe('approved');
    expect(rebuild).toHaveBeenCalledWith('d1');
    expect(mailer.sendDealerApprovalStatusEmail).toHaveBeenCalledWith('owner@example.com', 'approved', expect.anything());
  });

  it('approve is refused a second time once already approved (idempotency — brief §37)', async () => {
    const { svc } = makeContext();
    await svc.act('d1', { action: 'approve' });
    await expect(svc.act('d1', { action: 'approve' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('approve is refused for a draft (must be submitted first)', async () => {
    const { svc } = makeContext({ listingStatus: 'draft' });
    await expect(svc.act('d1', { action: 'approve' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('reject requires a note, sets rejected, and blocks the dealer from ever reaching payment', async () => {
    const { svc, dealer } = makeContext();
    await expect(svc.act('d1', { action: 'reject' })).rejects.toBeInstanceOf(BadRequestException);
    await svc.act('d1', { action: 'reject', note: 'Not a genuine food business.' });
    expect(dealer.listingStatus).toBe('rejected');
    expect(dealer.approvalNote).toBe('Not a genuine food business.');
  });

  it('request_changes requires a note and moves pending_review → changes_requested', async () => {
    const { svc, dealer, mailer } = makeContext();
    await expect(svc.act('d1', { action: 'request_changes' })).rejects.toBeInstanceOf(BadRequestException);
    await svc.act('d1', { action: 'request_changes', note: 'Please add your opening hours.' });
    expect(dealer.listingStatus).toBe('changes_requested');
    expect(dealer.approvalNote).toBe('Please add your opening hours.');
    expect(mailer.sendDealerApprovalStatusEmail).toHaveBeenCalledWith(
      'owner@example.com',
      'changes_requested',
      expect.anything(),
    );
  });

  it('suspend: any → suspended (removes it from customer search), index rebuilt', async () => {
    const { svc, dealer, rebuild } = makeContext({ listingStatus: 'active' });
    await svc.act('d1', { action: 'suspend' });
    expect(dealer.listingStatus).toBe('suspended');
    expect(rebuild).toHaveBeenCalledWith('d1');
  });

  it('reactivate: allowed from suspended (moderation), rejected from active', async () => {
    const active = makeContext({ listingStatus: 'active' });
    await expect(active.svc.act('d1', { action: 'reactivate' })).rejects.toBeInstanceOf(BadRequestException);

    const suspended = makeContext({ listingStatus: 'suspended' });
    await suspended.svc.act('d1', { action: 'reactivate' });
    expect(suspended.dealer.listingStatus).toBe('active');
  });

  it('reactivate is refused for an expired listing whose subscription is still lapsed', async () => {
    const { svc } = makeContext({
      listingStatus: 'expired',
      subscription: { status: 'canceled', cancelAtPeriodEnd: true, currentPeriodEnd: new Date(Date.now() - 1e7) },
    });
    await expect(svc.act('d1', { action: 'reactivate' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('verify sets verificationStatus + verifiedAt; unverify clears it (a paid sub never implies Verified)', async () => {
    const { svc, dealer } = makeContext();
    await svc.act('d1', { action: 'verify' });
    expect(dealer.verificationStatus).toBe('verified');
    expect(dealer.verifiedAt).toBeInstanceOf(Date);
    await svc.act('d1', { action: 'unverify' });
    expect(dealer.verificationStatus).toBe('unverified');
    expect(dealer.verifiedAt).toBeNull();
  });
});

describe('AdminDealersService.detail', () => {
  it('surfaces effective live status + open report count', async () => {
    const { svc } = makeContext({ listingStatus: 'active' });
    const detail = await svc.detail('d1');
    expect(detail.isLiveToCustomers).toBe(true); // active listing + active sub
    expect(detail.openReports).toBe(1);
    expect(detail.products).toHaveLength(1);
  });

  it('an inactive subscription means not live even with an active listing', async () => {
    const { svc } = makeContext({
      listingStatus: 'active',
      subscription: { status: 'canceled', cancelAtPeriodEnd: false, currentPeriodEnd: new Date(Date.now() - 1e6) },
    });
    const detail = await svc.detail('d1');
    expect(detail.isLiveToCustomers).toBe(false);
  });

  it('unknown dealer → 404', async () => {
    const { svc, prisma } = makeContext();
    (prisma.dealer.findUnique as jest.Mock).mockResolvedValueOnce(null);
    await expect(svc.detail('nope')).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('AdminDealersService.removeProduct / updateReport', () => {
  it('removes a product and rebuilds the index', async () => {
    const { svc, dealer, rebuild } = makeContext();
    await svc.removeProduct('d1', 'p1');
    expect(dealer.products).toHaveLength(0);
    expect(rebuild).toHaveBeenCalledWith('d1');
  });

  it("rejects a product id that isn't this dealer's", async () => {
    const { svc } = makeContext();
    await expect(svc.removeProduct('d1', 'other')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('transitions a report to actioned / dismissed', async () => {
    const { svc, reports } = makeContext();
    await svc.updateReport('d1', 'r1', { status: 'actioned' });
    expect(reports[0].status).toBe('actioned');
    expect(reports[0].reviewedAt).toBeInstanceOf(Date);
  });
});

describe('AdminDealersService.setRatingHidden', () => {
  it('delegates to DealerRatingService and returns fresh detail', async () => {
    const { svc, ratings } = makeContext();
    const detail = await svc.setRatingHidden('d1', 'rating1', { hidden: true });
    expect(ratings.setHidden).toHaveBeenCalledWith('d1', 'rating1', true);
    expect(detail.id).toBe('d1');
  });
});
