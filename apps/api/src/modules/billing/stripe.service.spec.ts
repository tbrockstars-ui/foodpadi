import { StripeService } from './stripe.service';

describe('StripeService demo mode', () => {
  const OLD_ENV = { ...process.env };
  let svc: StripeService;

  beforeEach(() => {
    process.env = { ...OLD_ENV, STRIPE_DEMO_MODE: 'true', WEB_APP_URL: 'https://app.test' };
    delete process.env.STRIPE_SECRET_KEY;
    delete process.env.STRIPE_PRICE_ID;
    svc = new StripeService();
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  it('is configured without any real Stripe keys', () => {
    expect(svc.isDemo).toBe(true);
    expect(svc.isConfigured).toBe(true);
    expect(svc.priceId).toBe('price_demo');
  });

  it('getOrCreateCustomer synthesises a customer id with no network call', async () => {
    const id = await svc.getOrCreateCustomer({ userId: 'user-1', email: 'ada@example.com' });
    expect(id).toBe('cus_demo_user-1');
  });

  it('getOrCreateCustomer still returns an existing customer id unchanged', async () => {
    const id = await svc.getOrCreateCustomer({
      userId: 'user-1',
      email: 'ada@example.com',
      existingCustomerId: 'cus_real_123',
    });
    expect(id).toBe('cus_real_123');
  });

  it('createCheckoutSession returns the local demo checkout page, carrying the amount/currency', async () => {
    const session = await svc.createCheckoutSession({
      customerId: 'cus_demo_user-1',
      userId: 'user-1',
      successUrl: 'https://app.test/premium/success?session_id={CHECKOUT_SESSION_ID}',
      cancelUrl: 'https://app.test/premium?checkout=cancelled',
      amountCents: 499,
      currency: 'usd',
    });
    expect(session.id).toMatch(/^cs_demo_/);
    const url = new URL(session.url!);
    expect(url.pathname).toBe('/premium/stripe-demo-checkout');
    expect(url.searchParams.get('session_id')).toBe(session.id);
    expect(url.searchParams.get('amount')).toBe('499');
    expect(url.searchParams.get('currency')).toBe('usd');
  });

  it('retrieveCheckoutSession round-trips the user/customer encoded in a demo session id', async () => {
    const created = await svc.createCheckoutSession({
      customerId: 'cus_demo_user-1',
      userId: 'user-1',
      successUrl: 'https://app.test/premium/success?session_id={CHECKOUT_SESSION_ID}',
      cancelUrl: 'https://app.test/premium?checkout=cancelled',
    });
    const session = await svc.retrieveCheckoutSession(created.id);
    expect(session.client_reference_id).toBe('user-1');
    expect((session.customer as { id: string }).id).toBe('cus_demo_user-1');
    const sub = session.subscription as import('stripe').Stripe.Subscription;
    expect(sub.status).toBe('active');
    expect(sub.customer).toBe('cus_demo_user-1');
    expect(sub.items.data[0].price.id).toBe('price_demo');
  });

  it('retrieveSubscription reconstructs the same synthetic subscription from its id', async () => {
    const created = await svc.createCheckoutSession({
      customerId: 'cus_demo_user-1',
      userId: 'user-1',
      successUrl: 'https://app.test/premium/success?session_id={CHECKOUT_SESSION_ID}',
      cancelUrl: 'https://app.test/premium?checkout=cancelled',
    });
    const session = await svc.retrieveCheckoutSession(created.id);
    const sub = session.subscription as import('stripe').Stripe.Subscription;
    const fetched = await svc.retrieveSubscription(sub.id);
    expect(fetched.id).toBe(sub.id);
    expect(fetched.status).toBe('active');
  });

  it('createPortalSession returns the local demo portal page', async () => {
    const session = await svc.createPortalSession({
      customerId: 'cus_demo_user-1',
      returnUrl: 'https://app.test/premium',
    });
    expect(session.url).toBe('https://app.test/premium/stripe-demo-portal');
  });

  it('outside demo mode with no keys it is not configured and priceId throws', () => {
    process.env = { ...OLD_ENV };
    delete process.env.STRIPE_DEMO_MODE;
    delete process.env.STRIPE_SECRET_KEY;
    delete process.env.STRIPE_PRICE_ID;
    const live = new StripeService();
    expect(live.isDemo).toBe(false);
    expect(live.isConfigured).toBe(false);
    expect(() => live.priceId).toThrow();
  });
});
