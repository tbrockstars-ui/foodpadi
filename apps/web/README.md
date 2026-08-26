# FoodPadi Web

Next.js (App Router, TypeScript). Per [docs/TECHNICAL_ARCHITECTURE.md §2.7](../../docs/TECHNICAL_ARCHITECTURE.md),
mobile is the flagship (marketed first, gets features first) but this is a
genuine full-parity customer client, not a teaser — modelled on how Samsung
Food actually splits `samsungfood.com` (marketing) from `app.samsungfood.com`
(a real, fully-authenticated web app). Three surfaces, one deploy:

1. **Landing page** (`/`) — marketing content for logged-out visitors:
   value proposition, App Store/Play Store links, a link into `/login`, and
   links to the food/safety disclaimer and privacy notice
   (`/legal/disclaimer`, `/legal/privacy`).
2. **Customer app** (`/login`, `/register`, `/plan`, `/shopping-list/[id]`,
   growing incrementally) — web ports of the equivalent mobile screens in
   `apps/mobile/src/screens/`, calling the same NestJS API via
   `@foodpadi/shared` types. See "Session handling" below. Current scope
   mirrors Plan Ahead + Shopping List; Eat Now, Cook Today, Import Recipe,
   Goals/Preferences editing and Profile are deferred to follow-up work.
3. **Admin/support page** (`/admin`) — staff-only, unchanged by the above;
   will host the admin/analytics capability (§38) and support tooling once
   the corresponding NestJS admin endpoints exist.

## Session handling

The customer app uses per-user httpOnly session cookies (`fp_access`,
`fp_refresh`), not client-visible tokens:

- `app/api/auth/{login,register}/route.ts` call the NestJS API and set the
  cookies on success; `app/api/auth/logout/route.ts` clears them.
- `app/api/proxy/[...path]/route.ts` is a generic authenticated proxy —
  client components call `/api/proxy/<nestjs-path>` instead of the API
  directly, since the browser can't send this app's cookie cross-origin to
  the API's own port.
- `middleware.ts` silently calls `/auth/refresh` when the access cookie has
  expired but the refresh cookie hasn't, before protected pages/routes run
  (Server Components can't set cookies mid-render, so this can't live in
  `lib/serverApi.ts`).
- `lib/serverApi.ts` (`serverFetch`, `requireSession`, `isAuthenticated`) is
  for Server Components fetching the API directly — no HTTP hop needed.

## Setup

```bash
npm install
npm run dev --workspace=@foodpadi/web
```

Needs `API_URL` (see `apps/web/.env.example`) to reach the NestJS API, and
`ADMIN_ACCESS_CODE` / `ADMIN_SESSION_SECRET` (root `.env.example`) to reach
`/admin` at all.

## ⚠️ Admin auth is a placeholder

`/admin` is currently gated by a single shared access code
(`lib/adminSession.ts`), HMAC-signed into a cookie so it isn't a bare flag —
but it is **not** real staff authentication and must not be treated as
sufficient once this page reads or writes any real user/support data. Before
that happens, replace it with per-person staff accounts, kept entirely
separate from end-user auth (never share a login mechanism between a
consumer account and staff access — see the architecture doc's non-negotiable
rules). This is tracked as an open Phase 1 follow-up, not a silent shortcut.
