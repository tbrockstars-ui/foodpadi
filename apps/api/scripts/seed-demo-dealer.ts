// Seeds a small set of Food Dealer Network fixtures for local demos + the
// brief §81 ranking check. Idempotent — matched by slug, re-run safely.
//
//   npm run seed:demo-dealers --workspace=@foodpadi/api
//
// Creates three Leicester dealers owned by a throwaway demo account. Being in
// the customer-facing network always requires an ACTIVE subscription (that's
// the whole business model); the difference is Featured vs plain organic:
//   A  Mama's African Foods      — relevant + subscribed + complete → FEATURED
//   B  African Taste Market      — relevant + subscribed + thin profile → ORGANIC
//   C  Leicester Pizza Kitchen   — irrelevant + subscribed → EXCLUDED by relevance
// so a search for "egusi leicester" should Feature A, list B organically, and
// never surface C at all.
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';

try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  require('dotenv').config();
} catch {
  /* rely on real env */
}

const prisma = new PrismaClient();

const OWNER_EMAIL = 'demo-dealer-owner@foodpadi.test';

async function ownerUser(): Promise<string> {
  const existing = await prisma.user.findUnique({ where: { email: OWNER_EMAIL } });
  if (existing) return existing.id;
  const user = await prisma.user.create({
    data: { email: OWNER_EMAIL, authProvider: 'password' },
  });
  return user.id;
}

interface Spec {
  slug: string;
  name: string;
  dealerType: string;
  categories: string[];
  cuisines: string[];
  products: string[];
  subscribe: boolean;
  verified: boolean;
  completeness: number;
  lat: number;
  lng: number;
}

const SPECS: Spec[] = [
  {
    slug: 'mamas-african-foods',
    name: "Mama's African Foods",
    dealerType: 'african_food_store',
    categories: ['African Food', 'Nigerian Food', 'Groceries'],
    cuisines: ['Nigerian'],
    products: ['Jollof Rice', 'Pounded Yam', 'Egusi Soup', 'Plantain', 'Palm Oil'],
    subscribe: true,
    verified: true,
    completeness: 92,
    lat: 52.6369,
    lng: -1.1398,
  },
  {
    slug: 'african-taste-market',
    name: 'African Taste Market',
    dealerType: 'grocery_dealer',
    categories: ['African Food', 'Groceries'],
    cuisines: ['Nigerian', 'Ghanaian'],
    products: ['Egusi Soup', 'Garri', 'Plantain', 'Scotch Bonnet'],
    subscribe: true,
    verified: false,
    completeness: 55,
    lat: 52.6501,
    lng: -1.14,
  },
  {
    slug: 'leicester-pizza-kitchen',
    name: 'Leicester Pizza Kitchen',
    dealerType: 'restaurant',
    categories: ['Pizza', 'Italian Food'],
    cuisines: ['Italian'],
    products: ['Margherita', 'Pepperoni', 'Garlic Bread'],
    subscribe: true,
    verified: false,
    completeness: 92,
    lat: 52.633,
    lng: -1.132,
  },
];

async function upsertDealer(ownerUserId: string, spec: Spec): Promise<string> {
  const existing = await prisma.dealer.findUnique({ where: { slug: spec.slug } });
  const base = {
    ownerUserId,
    slug: spec.slug,
    name: spec.name,
    dealerType: spec.dealerType,
    description: `${spec.name} — ${spec.categories.join(', ')} in Leicester.`,
    phone: '0116 555 0100',
    websiteUrl: `https://${spec.slug}.example`,
    openingHours: { mon: '09:00-18:00', tue: '09:00-18:00', wed: '09:00-18:00', thu: '09:00-18:00', fri: '09:00-19:00', sat: '09:00-17:00', sun: 'Closed' },
    categories: spec.categories,
    cuisines: spec.cuisines,
    productKeywords: spec.products,
    listingStatus: 'active',
    verificationStatus: spec.verified ? 'verified' : 'unverified',
    verifiedAt: spec.verified ? new Date() : null,
    submittedAt: new Date(),
    activatedAt: spec.subscribe ? new Date() : null,
  };

  const dealer = existing
    ? await prisma.dealer.update({ where: { id: existing.id }, data: base as any })
    : await prisma.dealer.create({ data: base as any });

  await prisma.dealerLocation.deleteMany({ where: { dealerId: dealer.id } });
  await prisma.dealerLocation.create({
    data: {
      dealerId: dealer.id,
      locality: 'Leicester',
      city: 'Leicester',
      region: 'Leicestershire',
      postcode: 'LE1 1AA',
      countryCode: 'GB',
      latitude: spec.lat,
      longitude: spec.lng,
      isPrimary: true,
      serviceAreas: ['Loughborough', 'Oadby', 'Wigston'],
    },
  });

  await prisma.dealerProduct.deleteMany({ where: { dealerId: dealer.id } });
  for (const name of spec.products) {
    await prisma.dealerProduct.create({
      data: {
        dealerId: dealer.id,
        name,
        available: true,
        keywords: name.toLowerCase().split(' '),
      },
    });
  }

  if (spec.subscribe) {
    const subData = {
      provider: 'stripe',
      status: 'active',
      plan: 'dealer_monthly',
      basePriceCents: 499,
      baseCurrency: 'usd',
      stripeCustomerId: `cus_demo_seed_${dealer.id.slice(0, 8)}`,
      stripeSubscriptionId: `sub_demo_seed_${dealer.id.slice(0, 8)}`,
      currentPeriodEnd: new Date(Date.now() + 30 * 86_400_000),
      cancelAtPeriodEnd: false,
    };
    await prisma.dealerSubscription.upsert({
      where: { dealerId: dealer.id },
      create: { dealerId: dealer.id, flwTxRef: `SEED-${randomUUID()}`, ...subData },
      update: subData,
    });
  } else {
    await prisma.dealerSubscription.deleteMany({ where: { dealerId: dealer.id } });
  }

  // Build the denormalised search-profile row directly (the NestJS
  // DealerSearchProfileService isn't importable from a standalone script).
  const norm = (s: string) =>
    s
      .toLowerCase()
      .replace(/['’]/g, '')
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  const localities = ['leicester', 'loughborough', 'oadby', 'wigston'];
  const profile = {
    searchText: [spec.name, ...spec.categories, ...spec.cuisines, ...spec.products, 'Leicester']
      .map(norm)
      .join(' '),
    localities,
    categoriesNorm: spec.categories.map(norm),
    productsNorm: spec.products.map(norm),
    cuisinesNorm: spec.cuisines.map(norm),
    primaryLat: spec.lat,
    primaryLng: spec.lng,
    completeness: spec.completeness,
    featuredEligible: spec.subscribe && spec.completeness >= 70,
    listingStatus: 'active',
    subscriptionActive: spec.subscribe,
    lastBuiltAt: new Date(),
  };
  await prisma.dealerSearchProfile.upsert({
    where: { dealerId: dealer.id },
    create: { dealerId: dealer.id, ...profile },
    update: profile,
  });
  await prisma.dealer.update({ where: { id: dealer.id }, data: { profileCompleteness: spec.completeness } });

  return dealer.id;
}

async function main(): Promise<void> {
  const ownerUserId = await ownerUser();
  for (const spec of SPECS) {
    const id = await upsertDealer(ownerUserId, spec);
    console.log(`  ${spec.subscribe ? '★' : ' '} ${spec.name}  →  /dealer/${spec.slug}  (${id})`);
  }
  console.log(
    '\nSeeded. Rebuild search profiles by hitting GET /dealers/search once (the service\n' +
      'rebuilds a stale profile lazily), or restart the API and run a search.\n' +
      'Try: GET /dealers/search?q=egusi%20leicester  → Mama\'s should be Featured, Pizza absent.',
  );
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
