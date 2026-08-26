# Implementation Plan

Phasing per spec §33/§44. Each phase ends with tests passing, types checked, and this plan updated with anything learned before moving on (§42).

## Phase 0 — Product Discovery ✅ (this pass)

Deliverables produced: [PRODUCT_DISCOVERY.md](PRODUCT_DISCOVERY.md), [ARCHITECTURE_ASSESSMENT.md](ARCHITECTURE_ASSESSMENT.md), [RISK_REGISTER.md](RISK_REGISTER.md), [MVP_SCOPE.md](MVP_SCOPE.md), plus the full documentation set in `/docs`. Repository initialized at the project root. No code written yet.

## Phase 1 — Foundation

- Repo scaffold: `/apps/mobile` (Expo/TypeScript, the only user-facing client), `/apps/api` (NestJS/TypeScript), `/apps/web` (Next.js — landing page + staff-only admin/support page, no user-facing features), `/packages/shared` (shared types/DTOs).
- Postgres (Neon) schema + Prisma migrations for identity/household/preferences/goals tables ([DATABASE_SCHEMA.md](DATABASE_SCHEMA.md) sections 1-2).
- Auth (email/password — built; Apple/Google + guest session — see below), session handling.
- Onboarding flow: disclaimer acknowledgement, **skippable** goal selection, optional preferences.
- Goals upgraded from single-select to multi-select (0-3 active goals, one flagged primary; history preserved via `is_active`/`is_primary` rather than deleting old rows — `20260826120000_goal_multiselect` migration, backfills each existing user's most recent goal as their primary). ✅ built (`EditGoalsScreen`, `GoalCard`, `GoalsEditor`, `GoalsService.setGoals`, `trackGoalEvent`).
- Privacy controls skeleton: view/export/delete profile.
- Analytics event pipeline wired to `food_events` from day one (§38 requires this from the start, not bolted on later). ✅ built (`AnalyticsService`, called inline from feature services — Cook Today is the first caller).

**Exit criteria:** a user can sign up, see the disclaimer, pick or skip a goal, and land on Home. Acceptance criteria 1-3, 17 from §40 pass. ✅ met, verified live against the real Neon DB.

**Superseded/refined by dedicated research:** the onboarding model above (mandatory goal, login-before-everything) was revisited in a full competitor/Reddit/privacy research pass — see [FOODPADI_LOGIN_ONBOARDING_RESEARCH.md](FOODPADI_LOGIN_ONBOARDING_RESEARCH.md) and its companion specs ([FOODPADI_ONBOARDING_SPEC.md](FOODPADI_ONBOARDING_SPEC.md), [FOODPADI_AUTHENTICATION_SPEC.md](FOODPADI_AUTHENTICATION_SPEC.md), [FOODPADI_PERSONALISATION_SPEC.md](FOODPADI_PERSONALISATION_SPEC.md), [FOODPADI_ONBOARDING_ANALYTICS.md](FOODPADI_ONBOARDING_ANALYTICS.md)). Net changes: the goal question becomes skippable; a guest-session concept is added so Eat Now/Cook Today can be used before an account exists (Plan Ahead remains account-first). Those docs' own P0-P3 backlogs are the authoritative sequencing for this area going forward.

**Landing page refresh (competitive scan against Samsung Food):** browsed samsungfood.com for genuine inspiration — layout strategy (full-bleed brand-colour hero, big bold left-aligned headline + visual, feature-row sections), not literal copying. Concretely borrowed: the "Get the free [app] app" full-bleed hero pattern, applied in FoodPadi green (`apps/web/app/page.tsx`), a free-license Google Font (`Plus Jakarta Sans` via `next/font/google`, self-hosted at build time) picked to evoke a similar geometric-friendly feel to their `SamsungOne`/`SamsungSharpSans` — their actual font files are Samsung's proprietary, non-licensable assets and were never used. Deliberately **not** adopted: their calorie/Health-Score-driven premium hook (conflicts with Decision 13 — FoodPadi never frames goals around weight/calories), fabricated testimonials or award badges (we have neither yet — the landing page uses an honest "Why FoodPadi is different" section instead), and recipe-community/social features (conflicts with the companion-not-chatbot positioning).

## Phase 2 — Cook Today (first pass ✅, in progress)

- Ingredient input UI (chips + free add) ✅ built (`CookTodayScreen`).
- Recipe generation: Layer 5 (`ClaudeService`, Anthropic SDK) → Layer 3 validation/sanitization (`CookTodayService.sanitize` — drops recipes with non-positive time/servings, fewer than 2 steps, or duplicate ingredients; enforces the requested time limit) → Layer 6 persistence on save (`Recipe`/`RecipeIngredient`). ✅ built and verified end-to-end against the real API, including the graceful "not configured yet" path when `ANTHROPIC_API_KEY` is unset.
- Guest-accessible per [FOODPADI_ONBOARDING_SPEC.md](FOODPADI_ONBOARDING_SPEC.md): guest session (`GuestSessionService`, `GuestOrAuthGuard`), guest-capable Home, contextual signup prompt on Save. ✅ built — this closes the P0/P1 guest-mode items from that spec's backlog.
- Time-constraint adaptation logic (Layer 3 re-ranks/adapts existing candidates, doesn't regenerate from scratch) — not yet built; current implementation regenerates on any input change. Tracked as a follow-up, not a launch blocker.
- Cook Mode (steps, timers, substitutions, pause/resume) — not yet built; the detail view currently shows static ingredients/steps only.
- Meal feedback capture → `meal_feedback`, feeds `ai_memory` — not yet built (depends on the `ai_memory` controller from [FOODPADI_PERSONALISATION_SPEC.md](FOODPADI_PERSONALISATION_SPEC.md), also not yet built).
- Import a recipe from a URL (`POST /recipe-import`, `ImportRecipeScreen`) — parses schema.org/Recipe JSON-LD embedded in the page (most recipe blogs already carry this for Google's rich-results feature), so it's deterministic and works today with no `ANTHROPIC_API_KEY` dependency; falls through to the same Layer 3 `sanitizeRecipeCandidate` gate and the existing save endpoint. Account-only, entry point on `CookTodayScreen`. Inspired by Samsung Food's "save a recipe from any website" feature (see competitive note below). Has a best-effort SSRF guard (rejects localhost/private-IP targets after DNS resolution) — not a full defence against DNS rebinding, which is an accepted gap for this pass. ✅ built and verified live end-to-end (import → preview → save) against a real recipe URL; a real parsing bug found during that verification (single-letter units like "l" matching the leading letter of "large"/"lemon") was fixed and reverified.

**Exit criteria:** acceptance criteria 6-7 pass (met for the core "generate → view → save" path); AI eval suite green for recipe sanity checks (Layer 3 validation exists and was verified manually against the graceful-failure path; a standing automated eval suite per [TEST_STRATEGY.md](TEST_STRATEGY.md) is not yet built — needs a live `ANTHROPIC_API_KEY` to exercise real model output, not just the 503 path).

## Phase 3 — Plan Ahead (first pass ✅, in progress)

- Plan scope selection (today/3-day/week/custom 1-14 days), optional budget hint. ✅ built (`PlanAheadScreen`, `PlanAheadService.generate`); budget is a soft steering hint passed to the model, not an enforced/priced constraint — no real UK pricing data source exists yet.
- Plan generation: same Layer 3 (`sanitizeRecipeCandidate`, shared with Cook Today) → Layer 5 (`ClaudeService.generatePlanMeals`) → Layer 6 persistence (`MealPlan`/`MealPlanItem`/`Recipe`) pipeline. Dinner-only, one meal/day, varies across days, respects favourite cuisines/avoided ingredients from the user's saved preferences. ✅ built, account-only (no guest access, per [FOODPADI_ONBOARDING_SPEC.md](FOODPADI_ONBOARDING_SPEC.md)). Verified end-to-end live against the real API/DB, including the graceful "not configured yet" 503 path when `ANTHROPIC_API_KEY` is unset — real AI-generated plan output remains unverified pending a configured key.
- Single-meal swap/regenerate and remove (not full-plan regeneration). ✅ built (`regenerateItem`, `removeItem`); unverified against real model output for the same API-key reason above.
- Accept flow (draft → accepted). ✅ built; unverified live for the same reason (requires a successfully generated plan first).
- Shopping list generation from an accepted plan (idempotent — re-calling returns the existing list), ingredient consolidation by name (quantities/units are joined as distinct strings rather than summed, to avoid fabricating an incorrect numeric total — no unit-conversion table exists). ✅ built (`ShoppingListScreen`, checklist UI with optimistic toggle, add/remove items); unverified live for the same reason. Pantry-subtraction logic — not yet built (pantry table is unused in MVP; tracked as a Phase 6 follow-up).
- Shopping list grouped by aisle (Fruit & Veg, Meat & Fish, Dairy & Eggs, etc.), inspired by Samsung Food's "sort by aisle" feature. ✅ built client-side only (`apps/mobile/src/constants/aisleCategories.ts`, deterministic keyword matching — no schema change, no AI call) to keep it independent of the shared migration another session had in flight on `schema.prisma` at the time.
- Bug fixed during verification: `GET /plan-ahead/current` returns HTTP 200 with an empty body (not JSON `null`) when no plan exists; the mobile API client's `request()` helper always called `response.json()`, which throws on an empty body — this left `PlanAheadScreen` stuck on its loading spinner forever for any first-time user. Fixed by having `request()` read the body as text and treat an empty string as `null` before parsing.

**Exit criteria:** acceptance criteria 8-11 partially verified — the full "generate a plan with real AI output → accept → shopping list" path needs a live `ANTHROPIC_API_KEY` to confirm end-to-end; everything short of an actual model call (routing, scope UI, resume-existing-plan, graceful failure, DB writes) has been verified live.

## Phase 4 — Eat Now (skeleton ✅, data source integration pending)

- Guest-accessible search screen (`EatNowScreen`) with the same disclaimer-gate pattern as Cook Today, wired into Home (`live: true`), and a real endpoint (`POST /eat-now/search`, `EatNowModule`) reachable by both guests and account users. ✅ built and verified live in both paths.
- NL request parsing (Layer 5) → structured query → Layer 4 ranking against `products`/`restaurants`/`menu_items` — deliberately **not** built yet: this needs a product decision on which UK data source to license/seed, which hasn't been made. `EatNowService.search` gates on this honestly (a 503 "no product or restaurant data source is connected", mirroring the `ANTHROPIC_API_KEY` gate pattern used elsewhere) rather than returning fabricated results. This is the "skeleton now, integrate the data source later" split requested for this phase.
- Filter UI (price/distance/cuisine/etc.) — DTO already accepts `maxPricePence`/`cuisine`; no filter chips in the UI yet since there's nothing real to filter against.
- Location permission flow (optional, foreground-only) — not yet built; deferred with the rest of the data-source integration.
- Source attribution shown wherever product/menu data is displayed — not yet applicable until a real data source exists.

**Exit criteria:** acceptance criteria 4-5 pending — blocked on the UK product/restaurant data source decision, not on anything structural.

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
