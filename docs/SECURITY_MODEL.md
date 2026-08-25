# Security Model

## Authentication & Session

- Email/password (hashed with a modern KDF, e.g. argon2/bcrypt via the auth provider) and Apple/Google sign-in.
- Short-lived access tokens + refresh tokens; refresh tokens revocable server-side (logout-everywhere supported).
- No credentials, tokens, or service-role keys ever stored in client code, logs, or crash reports.

## Authorization

- All authorization decisions are enforced server-side in the NestJS API, keyed on the authenticated session's user/household membership.
- Postgres Row-Level Security is applied as defence-in-depth (per-table policies keyed on `user_id`/`household_id`), not as the sole authorization mechanism — the client never holds a database credential capable of bypassing the API (§25 "never trust the client").
- Subscription/entitlement checks happen on every gated request server-side; the client's cached entitlement state is advisory UI only.

## Secrets Management

- LLM API keys, payment provider keys, and database service-role credentials live only in the backend's secret manager (e.g. environment-injected via the deployment platform's secrets store), never in the mobile bundle, never committed to the repo.
- `.env` files are gitignored from the first commit; a secret-scanning pre-commit/CI check blocks accidental commits of credentials.

## Transport & Storage

- TLS everywhere (client↔API, API↔DB, API↔third-party).
- Encryption at rest via the managed Postgres/storage provider; sensitive free-text fields (e.g. `avoided_ingredients.note`) get column-level encryption in addition to disk-level encryption, since they may contain special-category data (see [PRIVACY_DATA_MODEL.md](PRIVACY_DATA_MODEL.md)).

## Input/Output Validation

- All API inputs validated against a schema (e.g. class-validator/zod) at the controller boundary — no unvalidated input reaches a service or the database.
- LLM output is validated before display: safety-boundary filter (see [AI_SAFETY_POLICY.md](AI_SAFETY_POLICY.md)), ingredient/fact cross-check against Layer 1 source data, structural sanity checks on generated recipes.

## Abuse Protection

- Rate limiting per user/IP on auth endpoints, AI chat endpoints (also serves cost control, see [AI_ARCHITECTURE.md](AI_ARCHITECTURE.md)), and scan endpoints.
- Per-user AI call budgets enforced server-side, independent of provider-side throttling.

## Audit Logging

- `audit_logs` records security-relevant and business-critical actions (entitlement changes, account deletion, data export, admin actions) with actor, action, target, and timestamp — never raw sensitive payloads.

## Account & Data Lifecycle

- Account deletion is a real, verifiable delete (with the legally-required minimum retention window, if any, isolated from normal operational data) — not a soft "deactivate."
- Data export produces a complete, user-readable copy of profile, preferences, memory, plans, and history on request (§9, §26).

## What Is Never Exposed

API keys, service-role DB keys, other users' data, internal system prompts, admin credentials, or sensitive user data — enforced by the authorization boundary above, verified in Phase 8 authorization/data-leakage testing (see [TEST_STRATEGY.md](TEST_STRATEGY.md)).
