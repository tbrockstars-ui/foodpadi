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
`ADMIN_SESSION_SECRET` / `ADMIN_API_SECRET` (root `.env.example`) to reach
`/admin` at all.

## Admin auth

`/admin` is gated by real per-person staff accounts (`AdminStaffUser`, its own
table — never shared with end-user `User` rows or login), authenticated by
username + password (`apps/api/src/modules/admin/admin-auth.{controller,service}.ts`,
`bcryptjs`-hashed). A successful login gets an HMAC-signed cookie
(`lib/adminSession.ts`) carrying the staff member's identity, so every admin
action taken afterwards is attributable to a specific person, not just
"someone who knew a code."

There's no self-service signup or in-app staff management yet — accounts are
created (or password-reset) with a one-off script, run from `apps/api`:

```bash
npm run admin:create-staff-user -- <username> <password> ["Display Name"]
```

`ADMIN_API_SECRET` remains the separate service-to-service secret between this
app's admin routes and the API's `AdminApiGuard` (see
`apps/api/src/modules/admin/admin-api.guard.ts`) — it proves "this request
came from the web app's gated admin area," while the staff login above proves
*which person* is behind it. `ADMIN_ACCESS_CODE` is no longer used and can be
removed from `.env`.
