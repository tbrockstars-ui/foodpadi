// Idempotent Flutterwave bootstrap for the FoodPadi Premium Nigeria journey.
// Creates (or reuses) a single monthly NGN payment plan and prints the id.
//
// Run from apps/api (needs FLW_SECRET_KEY + FLW_NGN_AMOUNT in the environment
// or apps/api/.env):
//
//   npm run flw:setup
//
// Safe to re-run: an existing active plan named "FoodPadi Premium" with a
// monthly interval is reused (Flutterwave plan amounts are immutable, so a
// changed FLW_NGN_AMOUNT means creating a new plan and updating FLW_PLAN_ID).

try {
  // dotenv ships transitively via @nestjs/config.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  require('dotenv').config();
} catch {
  /* rely on real env vars */
}

const BASE_URL = 'https://api.flutterwave.com/v3';
const PLAN_NAME = 'FoodPadi Premium';

async function flw<T>(path: string, init?: RequestInit): Promise<T> {
  const key = process.env.FLW_SECRET_KEY;
  if (!key) {
    console.error('FLW_SECRET_KEY is not set. Add it to apps/api/.env or the environment.');
    process.exit(1);
  }
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });
  const body = (await res.json().catch(() => null)) as { status?: string; message?: string; data?: T } | null;
  if (!res.ok || body?.status === 'error') {
    throw new Error(body?.message ?? `Flutterwave request failed (${res.status}).`);
  }
  return body?.data as T;
}

async function main(): Promise<void> {
  const amount = Number.parseInt(process.env.FLW_NGN_AMOUNT ?? '', 10);
  if (!Number.isFinite(amount) || amount <= 0) {
    console.error('FLW_NGN_AMOUNT must be a positive whole number of Naira (e.g. 7500).');
    process.exit(1);
  }

  const plans = await flw<
    Array<{ id: number; name: string; amount: number; interval: string; status: string; currency?: string }>
  >('/payment-plans?status=active');

  const existing = (plans ?? []).find(
    (p) => p.name === PLAN_NAME && p.interval === 'monthly' && p.status === 'active',
  );

  if (existing) {
    console.log(`Reusing plan ${existing.id} — ${PLAN_NAME}, ₦${existing.amount}/${existing.interval}.`);
    if (existing.amount !== amount) {
      console.log(
        `\n⚠  FLW_NGN_AMOUNT (${amount}) differs from the existing plan amount (${existing.amount}).\n` +
          '   Flutterwave plan amounts are immutable — deactivate the old plan in the\n' +
          '   dashboard and re-run this script to create a new one if you want to change it.',
      );
    }
    console.log(`\n  FLW_PLAN_ID=${existing.id}`);
    return;
  }

  const created = await flw<{ id: number }>('/payment-plans', {
    method: 'POST',
    body: JSON.stringify({
      amount,
      name: PLAN_NAME,
      interval: 'monthly',
      currency: 'NGN',
      duration: 0, // 0 = charge until cancelled
    }),
  });

  console.log(`Created plan ${created.id} — ${PLAN_NAME}, ₦${amount}/month.`);
  console.log(`\n  FLW_PLAN_ID=${created.id}`);
  console.log(
    '\nAlso set, in the Flutterwave dashboard: a webhook URL\n' +
      '(https://<api-host>/billing/flutterwave/webhook) and a "Secret hash" —\n' +
      'put that hash in FLW_SECRET_HASH.',
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
