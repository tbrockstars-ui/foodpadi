'use client';

import type {
  CreateDealerRequest,
  DealerAnalyticsView,
  DealerCheckoutResponse,
  DealerCheckoutSyncRequest,
  DealerCheckoutSyncResponse,
  DealerLocationInput,
  DealerProductInput,
  DealerProfileView,
  DealerSubmitResponse,
  DealerSubscriptionView,
  DealerView,
  UpdateDealerRequest,
} from '@foodpadi/shared';

// Client-side calls to the dealer portal, all routed through /api/proxy (the
// browser can't reach the API cross-origin; the proxy attaches the session).
// Mirrors the error-shape handling in apps/web/lib/serverApi.ts.

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api/proxy/dealers${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  const text = await res.text();
  if (!res.ok) {
    let message = res.statusText;
    try {
      const body = JSON.parse(text) as { message?: string | string[] };
      message = Array.isArray(body.message) ? body.message.join('. ') : body.message ?? message;
    } catch {
      /* keep statusText */
    }
    throw new DealerApiError(res.status, message);
  }
  return (text ? JSON.parse(text) : null) as T;
}

export class DealerApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export const dealerApi = {
  getMine: () => call<DealerView>('/me'),
  create: (body: CreateDealerRequest) =>
    call<DealerView>('/me', { method: 'POST', body: JSON.stringify(body) }),
  update: (body: UpdateDealerRequest) =>
    call<DealerView>('/me', { method: 'PATCH', body: JSON.stringify(body) }),

  addLocation: (body: DealerLocationInput) =>
    call<DealerView>('/me/locations', { method: 'POST', body: JSON.stringify(body) }),
  updateLocation: (id: string, body: DealerLocationInput) =>
    call<DealerView>(`/me/locations/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  removeLocation: (id: string) => call<DealerView>(`/me/locations/${id}`, { method: 'DELETE' }),

  addProduct: (body: DealerProductInput) =>
    call<DealerView>('/me/products', { method: 'POST', body: JSON.stringify(body) }),
  updateProduct: (id: string, body: DealerProductInput) =>
    call<DealerView>(`/me/products/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  removeProduct: (id: string) => call<DealerView>(`/me/products/${id}`, { method: 'DELETE' }),
  duplicateProduct: (id: string) => call<DealerView>(`/me/products/${id}/duplicate`, { method: 'POST' }),

  submitState: () => call<DealerSubmitResponse>('/me/submit'),
  submit: () => call<DealerSubmitResponse>('/me/submit', { method: 'POST' }),
  preview: () => call<DealerProfileView>('/me/preview'),
  analytics: () => call<DealerAnalyticsView>('/me/analytics'),

  subscription: () => call<DealerSubscriptionView>('/me/subscription'),
  checkout: (provider?: 'stripe' | 'flutterwave') =>
    call<DealerCheckoutResponse>('/me/subscription/checkout', {
      method: 'POST',
      body: JSON.stringify(provider ? { provider } : {}),
    }),
  portalLink: () => call<{ url: string }>('/me/subscription/portal', { method: 'POST' }),
  cancel: () => call<DealerSubscriptionView>('/me/subscription/cancel', { method: 'POST' }),
  sync: (body: DealerCheckoutSyncRequest) =>
    call<DealerCheckoutSyncResponse>('/me/subscription/sync', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
};
