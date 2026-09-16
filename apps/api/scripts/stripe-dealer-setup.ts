// Idempotent Stripe bootstrap for the FoodPadi Food Dealer Network subscription
// — a SEPARATE product from FoodPadi Premium (dealer brief §13). Creates (or
// reuses) one Product and one recurring monthly Price in USD; Stripe Adaptive
// Pricing presents the customer's local currency at checkout, so there are no
// per-currency options to manage (brief §44: keep pricing simple).
//
// Run from apps/api (needs STRIPE_SECRET_KEY in the environment or apps/api/.env):
//
//   npm run stripe:dealer-setup
//
// Safe to re-run: the product is matched by metadata.foodpadi_key, and an
// existing matching active price is reused.
import Stripe from 'stripe';

try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  require('dotenv').config();
} catch {
  /* no dotenv — rely on real env vars */
}

const PRODUCT_KEY = 'foodpadi_food_dealer';
const BASE_CURRENCY = 'usd';
const BASE_UNIT_AMOUNT = Number.parseInt(process.env.DEALER_SUB_PRICE_CENTS ?? '', 10) || 499;

async function main(): Promise<void> {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    console.error('STRIPE_SECRET_KEY is not set. Add it to apps/api/.env or the environment.');
    process.exit(1);
  }
  const stripe = new Stripe(key, { appInfo: { name: 'FoodPadi dealer setup script' } });

  let product: Stripe.Product | undefined;
  for await (const p of stripe.products.list({ active: true, limit: 100 })) {
    if (p.metadata?.foodpadi_key === PRODUCT_KEY) {
      product = p;
      break;
    }
  }
  const description =
    'FoodPadi Food Dealer Network membership — a searchable dealer profile, local FoodPadi discovery, product/category indexing, Featured/Sponsored eligibility and a dealer dashboard.';
  if (product) {
    console.log(`Reusing product ${product.id} (${product.name}).`);
    await stripe.products.update(product.id, { name: 'FoodPadi Food Dealer', description });
  } else {
    product = await stripe.products.create({
      name: 'FoodPadi Food Dealer',
      description,
      metadata: { foodpadi_key: PRODUCT_KEY },
    });
    console.log(`Created product ${product.id}.`);
  }

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
    console.log(`Reusing price ${price.id}.`);
  } else {
    price = await stripe.prices.create({
      product: product.id,
      currency: BASE_CURRENCY,
      unit_amount: BASE_UNIT_AMOUNT,
      recurring: { interval: 'month' },
      metadata: { foodpadi_key: PRODUCT_KEY },
    });
    console.log(`Created price ${price.id}.`);
  }

  console.log('\nDone. Set these in the API environment:\n');
  console.log(`  STRIPE_DEALER_PRICE_ID=${price.id}`);
  console.log(
    '\nAlso in the Stripe Dashboard: enable Adaptive Pricing, add a webhook\n' +
      'endpoint for https://<api-host>/dealers/billing/webhook and copy its\n' +
      'signing secret to STRIPE_DEALER_WEBHOOK_SECRET. The Billing customer\n' +
      'portal set up for Premium already covers dealer subscriptions.',
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
