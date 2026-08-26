# FoodPadi API (Phase 1 Foundation + Phase 2 Cook Today, first pass)

NestJS + Prisma backend. Owns auth (incl. guest sessions), profile, food
goals, preferences, avoided ingredients, disclaimer acknowledgement, data
export/deletion, analytics events, and Cook Today recipe generation. See
[/docs](../../docs) for the full architecture and safety/privacy rationale.

## Setup

1. Copy the root `.env.example` to `.env` and fill in your Neon connection
   strings (`DATABASE_URL` = pooled, `DIRECT_URL` = direct — Prisma Migrate
   needs the direct one) and JWT secrets.
2. Install dependencies from the repo root: `npm install`.
3. Generate the Prisma client and run the first migration:
   ```bash
   npm run prisma:generate --workspace=@foodpadi/api
   npm run prisma:migrate --workspace=@foodpadi/api -- --name init
   ```
4. Start the API: `npm run api:dev`.

## Endpoints (Phase 1)

| Method | Path | Purpose |
|---|---|---|
| POST | `/auth/register` | Create account (email + password) |
| POST | `/auth/login` | Get access + refresh tokens |
| POST | `/auth/refresh` | Rotate refresh token |
| POST | `/auth/logout` | Revoke a refresh token |
| POST | `/auth/password-reset/request` | Request a reset token (always 204, even for unknown emails — no enumeration) |
| POST | `/auth/password-reset/confirm` | Set a new password with a valid token; revokes all existing sessions |
| GET | `/users/me` | Current profile |
| POST | `/users/me/disclaimer-acknowledge` | Record disclaimer acknowledgement (§12) |
| POST | `/users/me/complete-onboarding` | Mark onboarding complete (requires disclaimer first) |
| GET | `/users/me/export` | Full data export (§9, §26) |
| DELETE | `/users/me` | Hard account deletion (§25) |
| GET/PUT | `/users/me/goal` | Food/lifestyle goal (§10 — non-medical set only) |
| GET/POST/DELETE | `/users/me/preferences[/:id]` | Food preferences |
| GET/POST/DELETE | `/users/me/avoided-ingredients[/:id]` | "Foods I choose to avoid" — never framed as medical |
| POST | `/auth/guest-session` | Issue a short-lived guest session token (no account) |
| POST | `/auth/guest-session/disclaimer-acknowledge` | Reissue the guest token with disclaimer acknowledgement recorded |
| POST | `/cook-today/generate` | Generate 2-3 recipes from ingredients; accepts a user access token **or** a guest token |
| POST | `/cook-today/recipes` | Save a generated recipe — requires a real account |
| GET | `/cook-today/recipes` | List the current user's saved recipes |
| DELETE | `/cook-today/recipes/:id` | Soft-delete a saved recipe |

All `/users/me/*` routes require `Authorization: Bearer <accessToken>`. `/cook-today/generate` accepts either an access token or a guest token (see [FOODPADI_AUTHENTICATION_SPEC.md](../../docs/FOODPADI_AUTHENTICATION_SPEC.md)); the rest of `/cook-today/*` requires a real account.

## Tests

`npm run api:test` — unit tests for duration parsing and the goals service so
far; expands each phase per [docs/TEST_STRATEGY.md](../../docs/TEST_STRATEGY.md).

## Notes

- Apple/Google sign-in is not yet wired (email/password only in this pass) —
  tracked for the rest of Phase 1.
- Password reset emails are **not actually sent** — no email provider is
  configured yet, so `MailerService` (`src/common/mailer.service.ts`) just
  logs the reset token to the server console for local testing. Replace with
  a real provider (e.g. Resend/SES/SendGrid) before production; a user who
  can't receive the email can't recover their account.
- Cook Today's recipe generation (`ClaudeService`, `src/modules/ai/`) needs
  `ANTHROPIC_API_KEY` set — without it, `/cook-today/generate` returns a
  clear `503` rather than crashing, and the mobile UI shows a friendly
  "not ready yet" message.
- Planning, pantry, and subscription logic don't exist yet — that arrives in
  Phases 3+ per [docs/IMPLEMENTATION_PLAN.md](../../docs/IMPLEMENTATION_PLAN.md).
