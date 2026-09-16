// Idempotent Stripe bootstrap for FoodPadi Premium. Creates (or reuses) the
// ONE canonical Product and a single recurring monthly Price of $4.99 USD, with
// per-currency presentment amounts (`currency_options`) for the markets Stripe
// can localise. Prints the ids to put in the API environment.
//
// Run from apps/api (needs STRIPE_SECRET_KEY in the environment or apps/api/.env):
//
//   npm run stripe:setup
//
// Safe to re-run: the product is matched by metadata.foodpadi_key, and an
// existing matching active price is reused (its currency_options are refreshed).
// Also seeds the `billing_config` row so the admin dashboard starts from the
// same numbers.
import Stripe from 'stripe';
import { PrismaClient } from '@prisma/client';

// Kept in step with packages/shared DEFAULT_CURRENCY_OPTIONS — this script is
// run standalone (no bundler), so the map is inlined rather than imported.
const DEFAULT_CURRENCY_OPTIONS: Record<string, number> = {
  gbp: 449, eur: 499, chf: 499, sek: 5900, nok: 5900, dkk: 3900, pln: 2199,
  usd: 499, cad: 699, aud: 799, nzd: 899, sgd: 699, hkd: 3900, jpy: 750,
  aed: 1899, myr: 2299, brl: 2790, mxn: 9900, zar: 9900,
};

try {
  // dotenv ships transitively via @nestjs/config — load apps/api/.env if present.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  require('dotenv').config();
} catch {
  /* no dotenv — rely on real env vars */
}

const PRODUCT_KEY = 'foodpadi_premium';
const BASE_UNIT_AMOUNT = 499; // $4.99
const BASE_CURRENCY = 'usd';

// Presentment amounts are held BY STRIPE + billing_config (not an exchange rate
// in our code). The shared DEFAULT_CURRENCY_OPTIONS map is the single seed —
// tune the live values in the admin dashboard afterwards.
const CURRENCY_OPTIONS: Record<string, { unit_amount: number }> = Object.fromEntries(
  Object.entries(DEFAULT_CURRENCY_OPTIONS)
    .filter(([ccy]) => ccy !== BASE_CURRENCY)
    .map(([ccy, unit_amount]) => [ccy, { unit_amount }]),
);

async function main(): Promise<void> {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    console.error('STRIPE_SECRET_KEY is not set. Add it to apps/api/.env or the environment.');
    process.exit(1);
  }
  const stripe = new Stripe(key, { appInfo: { name: 'FoodPadi setup script' } });

  // 1. Product — find by metadata key, else create.
  let product: Stripe.Product | undefined;
  for await (const p of stripe.products.list({ active: true, limit: 100 })) {
    if (p.metadata?.foodpadi_key === PRODUCT_KEY) {
      product = p;
      break;
    }
  }
  if (product) {
    console.log(`Reusing product ${product.id} (${product.name}).`);
    await stripe.products.update(product.id, {
      name: 'FoodPadi Premium',
      description:
        'Persistent food memory, personalised meal planning, AI food assistance, advanced planning and premium cooking features.',
    });
  } else {
    product = await stripe.products.create({
      name: 'FoodPadi Premium',
      description:
        'Persistent food memory, personalised meal planning, AI food assistance, advanced planning and premium cooking features.',
      metadata: { foodpadi_key: PRODUCT_KEY },
    });
    console.log(`Created product ${product.id}.`);
  }

  // 2. Price — reuse an existing active $4.99 USD/month price if there is one.
  let price: Stripe.Price | undefined;
  for await (const pr of stripe.prices.list({ product: product.id, active: true, limit: 100 })) {
    if (
      pr.currency === BASE_CURRENCY &&
      pr.unit_amount === BASE_UNIT_AMOUNT &&
      pr.recurring?.interval === 'month'
    ) {
      price = pr;
      break;
    }
  }

  if (price) {
    console.log(`Reusing price ${price.id}. Refreshing currency_options…`);
    price = await stripe.prices.update(price.id, { currency_options: CURRENCY_OPTIONS });
  } else {
    price = await stripe.prices.create({
      product: product.id,
      currency: BASE_CURRENCY,
      unit_amount: BASE_UNIT_AMOUNT,
      recurring: { interval: 'month' },
      currency_options: CURRENCY_OPTIONS,
      metadata: { foodpadi_key: PRODUCT_KEY },
    });
    console.log(`Created price ${price.id}.`);
  }

  // 3. Seed billing_config so the admin dashboard starts from these numbers.
  try {
    const prisma = new PrismaClient();
    await prisma.billingConfig.upsert({
      where: { id: 'singleton' },
      create: {
        id: 'singleton',
        basePriceCents: BASE_UNIT_AMOUNT,
        baseCurrency: BASE_CURRENCY,
        currencyOptions: DEFAULT_CURRENCY_OPTIONS,
        stripePriceId: price.id,
      },
      update: { stripePriceId: price.id },
    });
    await prisma.$disconnect();
    console.log('Seeded billing_config (currency options + stripe price id).');
  } catch (err) {
    console.warn(`Could not seed billing_config (${String(err)}). Run prisma migrate first, then re-run.`);
  }

  console.log('\nDone. Set these in the API environment:\n');
  console.log(`  STRIPE_PRODUCT_ID=${product.id}`);
  console.log(`  STRIPE_PRICE_ID=${price.id}`);
  console.log(
    '\nAlso configure in the Stripe Dashboard: enable Adaptive Pricing, add the\n' +
      'webhook endpoint (https://<api-host>/billing/webhook) and copy its signing\n' +
      'secret to STRIPE_WEBHOOK_SECRET, and set up the Billing customer portal.\n' +
      'STRIPE_PRODUCT_ID is now also used to mint a new Price when the base price\n' +
      'is changed from the admin dashboard.',
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
