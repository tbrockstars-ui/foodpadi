# FoodPadi API (Phase 1 — Foundation)

NestJS + Prisma backend. Owns auth, profile, food goals, preferences, avoided
ingredients, disclaimer acknowledgement, and data export/deletion. See
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

All `/users/me/*` routes require `Authorization: Bearer <accessToken>`.

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
- No LLM, recipe, planning, pantry, or subscription logic lives here yet —
  that arrives in Phases 2-7 per [docs/IMPLEMENTATION_PLAN.md](../../docs/IMPLEMENTATION_PLAN.md).
