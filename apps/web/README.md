# FoodPadi Web

Next.js (App Router, TypeScript). Deliberately small: this is **not** a
customer-facing web app. Per [docs/TECHNICAL_ARCHITECTURE.md §2.7](../../docs/TECHNICAL_ARCHITECTURE.md),
the mobile app is the only place end users use FoodPadi's features. This app
has exactly two jobs:

1. **Landing page** (`/`) — marketing page directing visitors to install the
   mobile app, with links to the food/safety disclaimer and privacy notice
   (`/legal/disclaimer`, `/legal/privacy`).
2. **Admin/support page** (`/admin`) — staff-only, will host the admin/
   analytics capability (§38) and support tooling once the corresponding
   NestJS admin endpoints exist.

## Setup

```bash
npm install
npm run dev --workspace=@foodpadi/web
```

Needs `ADMIN_ACCESS_CODE` and `ADMIN_SESSION_SECRET` in `.env` (see root
`.env.example`) to reach `/admin` at all.

## ⚠️ Admin auth is a placeholder

`/admin` is currently gated by a single shared access code
(`lib/adminSession.ts`), HMAC-signed into a cookie so it isn't a bare flag —
but it is **not** real staff authentication and must not be treated as
sufficient once this page reads or writes any real user/support data. Before
that happens, replace it with per-person staff accounts, kept entirely
separate from end-user auth (never share a login mechanism between a
consumer account and staff access — see the architecture doc's non-negotiable
rules). This is tracked as an open Phase 1 follow-up, not a silent shortcut.
