import { FlutterwaveService } from './flutterwave.service';

describe('FlutterwaveService demo mode', () => {
  const OLD_ENV = { ...process.env };
  let svc: FlutterwaveService;

  beforeEach(() => {
    process.env = { ...OLD_ENV, FLW_DEMO_MODE: 'true', FLW_NGN_AMOUNT: '7500', WEB_APP_URL: 'https://app.test' };
    delete process.env.FLW_SECRET_KEY;
    delete process.env.FLW_PLAN_ID;
    svc = new FlutterwaveService();
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  it('is configured without any real Flutterwave keys', () => {
    expect(svc.isDemo).toBe(true);
    expect(svc.isConfigured).toBe(true);
  });

  it('serves a canned NGN plan (no network)', async () => {
    const plan = await svc.getPaymentPlan();
    expect(plan).toMatchObject({ amount: 7500, currency: 'NGN', interval: 'monthly', status: 'active' });
  });

  it('createPaymentLink returns the local demo checkout page', async () => {
    const url = await svc.createPaymentLink({
      userId: 'u1',
      email: 'ada@example.com',
      txRef: 'FP-abc-123',
      amountNaira: 7500,
      successUrl: 'https://app.test/premium/success?provider=flutterwave',
    });
    expect(url).toBe('https://app.test/premium/demo-checkout?tx_ref=FP-abc-123&amount=7500');
  });

  it('verifyTransaction treats a DEMO- id as a successful NGN charge and round-trips the tx_ref', async () => {
    const txn = await svc.verifyTransaction(FlutterwaveService.demoTransactionId('FP-abc-123'));
    expect(txn).toMatchObject({ tx_ref: 'FP-abc-123', status: 'successful', amount: 7500, currency: 'NGN' });
  });

  it('cancelSubscription is a no-op in demo mode', async () => {
    await expect(svc.cancelSubscription('0')).resolves.toBeUndefined();
  });

  it('falls back to the default demo amount when FLW_NGN_AMOUNT is unset', async () => {
    delete process.env.FLW_NGN_AMOUNT;
    const plan = await new FlutterwaveService().getPaymentPlan();
    expect(plan.amount).toBe(7500);
  });

  it('outside demo mode with no keys it is not configured', () => {
    process.env = { ...OLD_ENV };
    delete process.env.FLW_DEMO_MODE;
    delete process.env.FLW_SECRET_KEY;
    delete process.env.FLW_PLAN_ID;
    expect(new FlutterwaveService().isConfigured).toBe(false);
  });
});
