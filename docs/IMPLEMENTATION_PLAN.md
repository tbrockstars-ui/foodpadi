# Implementation Plan

Phasing per spec §33/§44. Each phase ends with tests passing, types checked, and this plan updated with anything learned before moving on (§42).

## Phase 0 — Product Discovery ✅ (this pass)

Deliverables produced: [PRODUCT_DISCOVERY.md](PRODUCT_DISCOVERY.md), [ARCHITECTURE_ASSESSMENT.md](ARCHITECTURE_ASSESSMENT.md), [RISK_REGISTER.md](RISK_REGISTER.md), [MVP_SCOPE.md](MVP_SCOPE.md), plus the full documentation set in `/docs`. Repository initialized at the project root. No code written yet.

## Phase 1 — Foundation

- Repo scaffold: `/apps/mobile` (Expo/TypeScript), `/apps/api` (NestJS/TypeScript), `/packages/shared` (shared types/DTOs).
- Postgres (Neon) schema + Prisma migrations for identity/household/preferences/goals tables ([DATABASE_SCHEMA.md](DATABASE_SCHEMA.md) sections 1-2).
- Auth (email + Apple/Google), session handling.
- Onboarding flow: disclaimer acknowledgement, goal selection, optional preferences.
- Privacy controls skeleton: view/export/delete profile.
- Analytics event pipeline wired to `food_events` from day one (§38 requires this from the start, not bolted on later).

**Exit criteria:** a user can sign up, see the disclaimer, pick a goal, and land on Home. Acceptance criteria 1-3, 17 from §40 pass.

## Phase 2 — Cook Today

- Ingredient input UI (chips + free add), recipe generation via Layer 4/5 against `recipes`/`ingredients` tables.
- Time-constraint adaptation logic (Layer 3 re-ranks/adapts existing candidates, doesn't regenerate from scratch).
- Cook Mode (steps, timers, substitutions, pause/resume).
- Meal feedback capture → `meal_feedback`, feeds `ai_memory`.

**Exit criteria:** acceptance criteria 6-7 pass; AI eval suite green for recipe sanity checks.

## Phase 3 — Plan Ahead

- Plan scope selection, plan generation against budget/household/goal constraints (Layer 3 budget engine).
- Single-meal swap/regenerate (not full-plan regeneration).
- Shopping list generation from an accepted plan, pantry-subtraction logic (pantry table exists but MVP may have it empty until Phase 6 — subtraction logic still built and tested against seeded data).

**Exit criteria:** acceptance criteria 8-11 pass.

## Phase 4 — Eat Now

- NL request parsing (Layer 5) → structured query → Layer 4 ranking against `products`/`restaurants`/`menu_items` (seeded/licensed UK data source).
- Location permission flow (optional, foreground-only).
- Filter UI (price/distance/cuisine/etc.).
- Source attribution shown wherever product/menu data is displayed.

**Exit criteria:** acceptance criteria 4-5 pass.

## Phase 5 — Companion

- Reminder engine (scheduler + trigger table from [NOTIFICATION_STRATEGY.md](NOTIFICATION_STRATEGY.md)).
- Plan confirmation nudges (Home screen companion card).
- Plan Rescue flow (§8) — five-option response, wired into existing Cook Today/Eat Now/plan-edit flows.
- Personal memory feedback loop (explicit + inferred facts, user-correctable).

**Exit criteria:** acceptance criteria 12-13, 15-16 pass.

## Phase 6 — Scan

- Barcode scanning (fast win — deterministic lookup, no AI vision needed).
- Receipt scanning and photo-based pantry/fridge detection (AI vision), **always** behind an explicit user-confirm-before-write step.

**Exit criteria:** no AI guess is ever persisted without confirmation (verified by a specific test, not just code review).

## Phase 7 — Premium

- RevenueCat integration, `subscriptions` table + webhook handler.
- Feature gating via a single reusable entitlement-check service.
- Trial, upgrade, cancellation, restoration flows.

**Exit criteria:** acceptance criteria 18-19 pass; no gated feature is reachable by a free-tier user via any endpoint (explicit negative test per endpoint).

## Phase 8 — Production Hardening

Security review, privacy review, AI safety review, performance testing, accessibility testing, real-device mobile testing, error handling/observability validation, analytics validation, cost monitoring validation, abuse testing, prompt-injection testing, authorization testing, data-leakage testing — per [TEST_STRATEGY.md](TEST_STRATEGY.md).

**Exit criteria:** production-readiness checklist (below) fully green; [RISK_REGISTER.md](RISK_REGISTER.md) has no open P0 items.

## Production-Readiness Checklist

- [ ] All 20 acceptance criteria (§40) pass end-to-end
- [ ] AI eval suite: zero failures in medical/allergy-safety categories
- [ ] Legal review complete on disclaimer copy and privacy notice
- [ ] DPIA completed or explicitly waived with rationale
- [ ] Security review complete (authZ, secrets, data leakage)
- [ ] No hard-coded pricing/entitlement values
- [ ] Error monitoring and AI cost monitoring live in production
- [ ] Account deletion and data export verified against real data, not just happy-path test data
- [ ] App Store/Play Store submission copy reviewed against health-claim risk ([RISK_REGISTER.md](RISK_REGISTER.md) R11)

## Next Immediate Step

Phase 1 scaffolding. Recommend confirming the Phase 1 backlog breakdown (tickets) before writing application code, given the size of this project.
