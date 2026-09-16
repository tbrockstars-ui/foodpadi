import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { DealerPortalService } from './dealer-portal.service';
import { PrismaService } from '../../prisma/prisma.service';
import { DealerEntitlementService } from './dealer-entitlement.service';
import { DealerSearchProfileService } from './dealer-search-profile.service';
import { DealerSubscriptionService } from './dealer-subscription.service';
import { DealerAuditService } from './dealer-audit.service';

// A tiny in-memory Prisma stand-in — enough of dealer / dealerLocation /
// dealerProduct for the portal service's reads and writes, so ownership and
// lifecycle assertions are real.
function makePrisma() {
  const dealers: any[] = [];
  const locations: any[] = [];
  const products: any[] = [];
  let seq = 1;
  const id = (p: string) => `${p}${seq++}`;

  const withChildren = (d: any) =>
    d && {
      ...d,
      locations: locations.filter((l) => l.dealerId === d.id),
      products: products.filter((p) => p.dealerId === d.id),
    };

  return {
    _dealers: dealers,
    _locations: locations,
    _products: products,
    dealer: {
      findFirst: jest.fn(async ({ where }: any) => {
        const d = dealers.find(
          (x) => x.ownerUserId === where.ownerUserId && (where.deletedAt === null ? !x.deletedAt : true),
        );
        return where.include || true ? withChildren(d) : d;
      }),
      findUnique: jest.fn(async ({ where }: any) => {
        const d = where.id
          ? dealers.find((x) => x.id === where.id)
          : dealers.find((x) => x.slug === where.slug);
        return withChildren(d);
      }),
      create: jest.fn(async ({ data }: any) => {
        const d = {
          id: id('d'),
          deletedAt: null,
          description: null,
          phone: null,
          websiteUrl: null,
          orderUrl: null,
          whatsapp: null,
          openingHours: null,
          categories: [],
          cuisines: [],
          productKeywords: [],
          dietaryTags: [],
          serviceType: [],
          verificationStatus: 'unverified',
          profileCompleteness: 0,
          submittedAt: null,
          activatedAt: null,
          createdAt: new Date(),
          ...data,
        };
        dealers.push(d);
        return withChildren(d);
      }),
      update: jest.fn(async ({ where, data }: any) => {
        const d = dealers.find((x) => x.id === where.id);
        Object.assign(d, data);
        return withChildren(d);
      }),
    },
    dealerLocation: {
      create: jest.fn(async ({ data }: any) => {
        const l = { id: id('l'), serviceAreas: [], createdAt: new Date(), ...data };
        locations.push(l);
        return l;
      }),
      update: jest.fn(async ({ where, data }: any) => {
        const l = locations.find((x) => x.id === where.id);
        Object.assign(l, data);
        return l;
      }),
      updateMany: jest.fn(async ({ where, data }: any) => {
        for (const l of locations.filter((x) => x.dealerId === where.dealerId)) Object.assign(l, data);
        return { count: 1 };
      }),
      delete: jest.fn(async ({ where }: any) => {
        const i = locations.findIndex((x) => x.id === where.id);
        if (i >= 0) locations.splice(i, 1);
        return {};
      }),
      findMany: jest.fn(async ({ where }: any) =>
        locations.filter((x) => x.dealerId === where.dealerId),
      ),
    },
    dealerProduct: {
      count: jest.fn(async ({ where }: any) => products.filter((x) => x.dealerId === where.dealerId).length),
      create: jest.fn(async ({ data }: any) => {
        const p = { id: id('p'), createdAt: new Date(), ...data };
        products.push(p);
        return p;
      }),
      update: jest.fn(async ({ where, data }: any) => {
        const p = products.find((x) => x.id === where.id);
        Object.assign(p, data);
        return p;
      }),
      delete: jest.fn(async ({ where }: any) => {
        const i = products.findIndex((x) => x.id === where.id);
        if (i >= 0) products.splice(i, 1);
        return {};
      }),
    },
    dealerEvent: { findMany: jest.fn(async () => []) },
    dealerAuditLog: { create: jest.fn(async ({ data }: any) => data), findMany: jest.fn(async () => []) },
  };
}

function build() {
  const prisma = makePrisma();
  const entitlement = { isActive: jest.fn().mockResolvedValue(false) } as unknown as DealerEntitlementService;
  const searchProfile = { rebuild: jest.fn().mockResolvedValue(undefined) } as unknown as DealerSearchProfileService;
  const subscriptions = {
    getView: jest.fn(),
    createCheckout: jest.fn().mockResolvedValue({ url: 'https://checkout.example/x', provider: 'stripe' }),
    createPortal: jest.fn(),
    cancel: jest.fn(),
    syncCheckoutSession: jest.fn(),
  } as unknown as DealerSubscriptionService;
  const audit = new DealerAuditService(prisma as unknown as PrismaService);
  const svc = new DealerPortalService(
    prisma as unknown as PrismaService,
    entitlement,
    searchProfile,
    subscriptions,
    audit,
  );
  return { svc, prisma, searchProfile, subscriptions };
}

async function seedComplete(svc: DealerPortalService, userId: string, name = "Mama's African Foods") {
  await svc.create(userId, { name, dealerType: 'african_food_store' });
  await svc.update(userId, {
    description: 'Nigerian groceries in Leicester.',
    phone: '0116 555 0100',
    categories: ['African Food', 'Nigerian Food'],
    cuisines: ['Nigerian'],
    openingHours: { mon: '09:00-18:00' },
  });
  await svc.addLocation(userId, { locality: 'Leicester' });
  await svc.addProduct(userId, { name: 'Egusi Soup' });
}

describe('DealerPortalService — ownership', () => {
  it('a second account cannot see or edit the first account\'s dealer', async () => {
    const { svc } = build();
    await svc.create('userA', { name: 'A Foods', dealerType: 'restaurant' });

    await expect(svc.getMine('userB')).rejects.toBeInstanceOf(NotFoundException);
    await expect(svc.update('userB', { name: 'hijack' })).rejects.toBeInstanceOf(NotFoundException);
    await expect(svc.addProduct('userB', { name: 'x' })).rejects.toBeInstanceOf(NotFoundException);
    await expect(svc.submit('userB')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('one account cannot manage two dealers', async () => {
    const { svc } = build();
    await svc.create('userA', { name: 'A Foods', dealerType: 'restaurant' });
    await expect(
      svc.create('userA', { name: 'A Foods 2', dealerType: 'bakery' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('a location / product id from another dealer is rejected', async () => {
    const { svc } = build();
    await seedComplete(svc, 'userA');
    await svc.create('userB', { name: 'B Foods', dealerType: 'restaurant' });
    const a = await svc.getMine('userA');
    await expect(svc.removeProduct('userB', a.products[0].id)).rejects.toBeInstanceOf(NotFoundException);
    await expect(svc.removeLocation('userB', a.locations[0].id)).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('DealerPortalService — lifecycle', () => {
  it('create → draft, completeness 0-ish, first location auto-primary', async () => {
    const { svc, searchProfile } = build();
    const d = await svc.create('u1', { name: 'X Foods', dealerType: 'restaurant' });
    expect(d.listingStatus).toBe('draft');
    expect(searchProfile.rebuild).toHaveBeenCalledWith(d.id);

    const withLoc = await svc.addLocation('u1', { locality: 'Leicester' });
    expect(withLoc.locations[0].isPrimary).toBe(true);
  });

  it('submit is refused while hard fields are missing', async () => {
    const { svc } = build();
    await svc.create('u1', { name: 'X Foods', dealerType: 'restaurant' });
    await expect(svc.submit('u1')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('submit succeeds once complete → pending_review (admin-approval-before-payment; no auto-approve), soft gaps returned', async () => {
    const { svc } = build();
    await seedComplete(svc, 'u1');
    const res = await svc.submit('u1');
    expect(res.dealer.listingStatus).toBe('pending_review');
    expect(res.dealer.submittedAt).not.toBeNull();
    // description/cuisines/hours were provided, so nothing soft remains
    expect(res.missing).toEqual([]);
  });

  it('submit is idempotent while already pending_review — no duplicate audit entry', async () => {
    const { svc, prisma } = build();
    await seedComplete(svc, 'u1');
    await svc.submit('u1');
    (prisma.dealerAuditLog.create as jest.Mock).mockClear();
    await svc.submit('u1');
    expect(prisma.dealerAuditLog.create).not.toHaveBeenCalled();
  });

  it('resubmitting after changes_requested clears the admin note and goes back to pending_review', async () => {
    const { svc, prisma } = build();
    await seedComplete(svc, 'u1');
    await svc.submit('u1');
    const dealer = prisma._dealers[0];
    dealer.listingStatus = 'changes_requested';
    dealer.approvalNote = 'Please add your opening hours.';

    const res = await svc.submit('u1');
    expect(res.dealer.listingStatus).toBe('pending_review');
    expect(dealer.approvalNote).toBeNull();
  });

  it('a rejected dealer can correct their profile and resend for review — rejection is not permanently terminal (user instruction, 2026-09-15)', async () => {
    const { svc, prisma } = build();
    await seedComplete(svc, 'u1');
    await svc.submit('u1');
    const dealer = prisma._dealers[0];
    dealer.listingStatus = 'rejected';
    dealer.approvalNote = 'Not a genuine food business.';

    const res = await svc.submit('u1');
    expect(res.dealer.listingStatus).toBe('pending_review');
    expect(dealer.approvalNote).toBeNull();
    // Same dealer/application row throughout — no duplicate created.
    expect(prisma._dealers).toHaveLength(1);
  });

  it('createCheckout is refused for a pending/unapproved dealer (brief §22 — server-side, not just hidden in the UI)', async () => {
    const { svc } = build();
    await seedComplete(svc, 'u1');
    await svc.submit('u1'); // → pending_review, not approved
    await expect(svc.createCheckout('u1', 'owner@example.com')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('createCheckout is refused for a rejected dealer', async () => {
    const { svc, prisma } = build();
    await seedComplete(svc, 'u1');
    prisma._dealers[0].listingStatus = 'rejected';
    await expect(svc.createCheckout('u1', 'owner@example.com')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('createCheckout succeeds once approved', async () => {
    const { svc, prisma, subscriptions } = build();
    await seedComplete(svc, 'u1');
    prisma._dealers[0].listingStatus = 'approved';
    await svc.createCheckout('u1', 'owner@example.com');
    expect(subscriptions.createCheckout).toHaveBeenCalled();
  });

  it('not live to customers until BOTH an approved+active listing and active subscription', async () => {
    const { svc, prisma } = build();
    await seedComplete(svc, 'u1');
    await svc.submit('u1'); // → pending_review, not yet live
    let d = await svc.getMine('u1');
    expect(d.isLiveToCustomers).toBe(false);

    // Even with an active subscription, a merely pending_review dealer is
    // still not live — approval always comes first (admin-approval-before-
    // payment, 2026-09-11).
    (svc as any).entitlement.isActive.mockResolvedValue(true);
    d = await svc.getMine('u1');
    expect(d.isLiveToCustomers).toBe(false);

    // Once admin has approved AND the search-profile rebuild has activated the
    // listing (DealerSearchProfileService owns that transition — exercised in
    // its own spec), isLiveToCustomers reflects both conditions being true.
    prisma._dealers[0].listingStatus = 'active';
    d = await svc.getMine('u1');
    expect(d.isLiveToCustomers).toBe(true);
  });
});

describe('DealerPortalService — input hygiene', () => {
  it('duplicate / blank categories are de-duplicated (case-insensitive)', async () => {
    const { svc } = build();
    await svc.create('u1', { name: 'X', dealerType: 'restaurant' });
    const d = await svc.update('u1', { categories: ['African Food', 'african food', '  ', 'Groceries'] });
    expect(d.categories).toEqual(['African Food', 'Groceries']);
  });

  it('a bare-domain website is stored as a full https URL, junk becomes null', async () => {
    const { svc } = build();
    await svc.create('u1', { name: 'X', dealerType: 'restaurant' });
    const d1 = await svc.update('u1', { websiteUrl: 'mamas-foods.co.uk' });
    expect(d1.websiteUrl).toBe('https://mamas-foods.co.uk/');
    const d2 = await svc.update('u1', { websiteUrl: 'not a url' });
    expect(d2.websiteUrl).toBeNull();
    const d3 = await svc.update('u1', { websiteUrl: '   ' });
    expect(d3.websiteUrl).toBeNull();
  });

  it('product keywords are seeded from the name so "jollof" matches "Jollof Rice"', async () => {
    const { svc, prisma } = build();
    await svc.create('u1', { name: 'X', dealerType: 'restaurant' });
    await svc.addProduct('u1', { name: 'Jollof Rice', category: 'Nigerian Food' });
    const created = prisma._products[0];
    expect(created.keywords).toEqual(expect.arrayContaining(['jollof', 'rice', 'nigerian']));
  });
});
