# Implementation Plan

Phasing per spec §33/§44. Each phase ends with tests passing, types checked, and this plan updated with anything learned before moving on (§42).

**Bug fixed while verifying Eat Now live:** `apps/api/src/main.ts`'s CORS config only allowed the Next.js web app's origin (needed for its httpOnly-cookie session work) — this silently broke browser-based testing of the mobile app's web build (`expo start --web`, port 8081), which is a real browser and is CORS-checked (unlike native RN). Added `http://localhost:8081` alongside the web app's origin rather than replacing it.

## Home repositioned as a unified "What should I eat?" decision flow

Following a competitive analysis against Samsung Food (see the earlier landing-page note above), Home was reworked from three parallel mode buttons (Eat Now / Cook Today / Plan Ahead) — which just repeated the "which tool do I pick?" decision-fatigue problem the analysis flagged — into a single front door: **"What should I eat?"** plus six situational chips (Quick, Cheap, Filling, Family, Use what I have, Something different) and one "Ask FoodPadi" button, with the three tools demoted to secondary shortcuts underneath. This is a UX/routing change only — no new AI, no new engine, no rebuild of Eat Now/Cook Today/Plan Ahead's internals.

- `packages/shared/src/foodDecisionRouter.ts` — pure routing logic (`routeFoodDecision`), unit-tested (`foodDecisionRouter.spec.ts`, 8 cases covering every chip and combination). "Family"/"Use what I have" route to Cook Today's existing ingredient-picker screen (there's no honest way to answer them without real ingredient input, and building that would be pantry-scanning scope, explicitly out of bounds for this pass). Everything else becomes an Eat Now query; "Cheap" maps to the existing `maxPricePence` filter rather than a keyword (no catalog entry contains the literal word "cheap"). ✅ built and verified live end-to-end for both branches (Quick → Eat Now auto-search; Use what I have → Cook Today) plus the secondary shortcuts (Plan Ahead, direct Eat Now) still working unchanged.
- `EatNowService` gained a small "surprise me" fallback (`different`/`surprise`/`anything`/`variety` in the query bypasses keyword scoring and returns a shuffled sample instead of an empty result) — this is what makes the "Something different" chip and a chip-less "Ask FoodPadi" tap produce something useful rather than a dead end, without touching the normal (non-wildcard) empty-result behaviour.
- `EatNowScreen` now accepts optional route params (`initialQuery`, `initialMaxPricePence`, `whyLabel`) so it can be deep-linked into with a pre-built query and auto-run the search, showing a "Because you're after: …" line and capping results at 3 (vs. 5 for a manually typed search) — reusing the existing screen and endpoint rather than building a second results UI.
- Landing page (`apps/web`) copy was **not** updated to match this positioning yet — deliberately deferred since `apps/web` has substantial unrelated work in progress elsewhere with its own dev server running; revisit once that work is committed.

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
- Recipe generation: Layer 5 (`ClaudeService`, Anthropic SDK) → Layer 3 validation/sanitization (`CookTodayService.sanitize` — drops recipes with non-positive time/servings, fewer than 2 steps, or duplicate ingredients; enforces the requested time limit) → Layer 6 persistence on save (`Recipe`/`RecipeIngredient`). `ClaudeService` now has a curated fallback (`curatedFallback()`) serving real, hand-written recipes through the same Layer 3 gate when `ANTHROPIC_API_KEY` is unset, rather than a 503 — Cook Today (and Plan Ahead) work end-to-end today with no key configured. ✅ built and verified end-to-end against the real API.
- Guest-accessible per [FOODPADI_ONBOARDING_SPEC.md](FOODPADI_ONBOARDING_SPEC.md): guest session (`GuestSessionService`, `GuestOrAuthGuard`), guest-capable Home, contextual signup prompt on Save. ✅ built — this closes the P0/P1 guest-mode items from that spec's backlog.
- Built on web (`apps/web/app/cook-today`), following the established server-component + client-form pattern (`CookTodayForm.tsx` calling `/api/proxy/cook-today/generate` and `/api/proxy/cook-today/recipes`) — account-only, no guest mode on web yet. Closes another item from the user's MVP priority table. ✅ built and verified live via real browser clicks: selected ingredients, generated recipes, opened one, saved it, confirmed it persisted via a direct DB-backed API check.
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

## Phase 4 — Eat Now (MVP dataset ✅, real data source integration pending)

- Guest-accessible search screen (`EatNowScreen`) with the same disclaimer-gate pattern as Cook Today, wired into Home (`live: true`), and a real endpoint (`POST /eat-now/search`, `EatNowModule`) reachable by both guests and account users. ✅ built and verified live in both paths.
- NL request parsing → Layer 4 ranking: since it's MVP and no UK product/restaurant data source has been licensed yet, `EatNowService.search` matches the query (plus optional `cuisine`/`maxPricePence` filters) against a small hand-curated dataset of ~25 generic food ideas (`eat-now-catalog.ts`) via deterministic keyword scoring — not fabricated restaurant/price/availability data, just honest "things you could eat" suggestions in the same spirit as Cook Today's recipes. `EatNowScreen` shows an explicit "example suggestions, not real-time listings" note so this is never mistaken for live commerce data. ✅ built and verified live against several real queries (keyword matches, cuisine filter, empty-result handling all correct).
- Swappable later: the interface (`search(dto, actor) => FoodIdeaView[]`) stays the same whether ranking comes from this static catalog or, once a real data source and `ANTHROPIC_API_KEY`-backed ranking exist, from a Layer 5 model call.
- Personalised for signed-in users, per the user's explicit MVP principle ("the smallest product that makes someone return"): avoided ingredients are a hard exclusion from results (same non-negotiable treatment as Cook Today/Plan Ahead — a chicken-tagged dish never appears for someone who avoids chicken), and favourite cuisines only re-rank *within* results that already matched the query (a liked cuisine can't override what was actually searched for, it can only push an already-relevant match higher). Guests get the same matcher with no personalisation, since there's nothing stored to personalise from. ✅ built and verified live: same "quick" query returned different, correctly-adjusted rankings before vs. after a test account added a favourite cuisine and an avoided ingredient.
- Filter UI (price/distance/cuisine/etc.) — DTO/service already support `maxPricePence`/`cuisine`; no filter chips in the UI yet.
- Location permission flow, real source attribution — not yet built; deferred with the rest of the real-data-source integration.
- Bug fixed: a query like "a nigerian dish" tokenized to include filler words ("a"), and plain substring matching meant "a" matched almost every catalog entry as a substring of some other word — swamping the one real, specific token ("nigerian") that matched nothing. Fixed by stripping short/filler words before scoring (`meaningfulTokens`). Uncovered a real content gap in the same pass: "Nigerian & West African", "Mediterranean", and "French" are offered as favourite-cuisine options during onboarding but had zero matching catalog entries — closed with 7 new curated dishes. Also fixed the favourite-cuisine boost, which compared cuisines by strict equality (`"british" !== "british & comfort food"`) and so never actually fired for onboarding's full-label cuisine values — now a substring comparison.
- Illustrative distance/delivery-time/price estimates added per the user's explicit request, to make results "feel more complete" — deterministic per dish (`eat-now-estimates.ts`, a stable hash of the id, never randomised per-request), explicitly **not** real location, live pricing, or a real delivery ETA (no location capability or retailer integration exists). The disclaimer note was extended to say so explicitly, and values use ranges/a "~" prefix rather than falsely-precise single numbers, since a specific decimal price or exact-minute ETA reads as live data even next to a caveat. ✅ built and verified live.
- Bug fixed during that verification: after a guest acknowledges the disclaimer, `EatNowScreen`'s auto-run search (deep-linked from the unified Home flow) called `guestSession.ensureSession()` again using a stale closure — since the guest-session context hadn't re-rendered yet, this created a **second, still-unacknowledged** guest session and the search was rejected with 403. Fixed by having `GuestSessionContext.acknowledgeDisclaimer()` return the freshly-acknowledged token directly, so the caller uses that instead of re-deriving one.

**Exit criteria:** acceptance criteria 4-5 pass for the MVP dataset; the real UK product/restaurant data source decision remains open and would replace `eat-now-catalog.ts`, not the surrounding architecture.

## Phase 5 — Companion

- Reminder engine (scheduler + trigger table from [NOTIFICATION_STRATEGY.md](NOTIFICATION_STRATEGY.md)).
- Plan confirmation nudges (Home screen companion card).
- Plan Rescue flow (§8) — five-option response, wired into existing Cook Today/Eat Now/plan-edit flows.
- Personal memory feedback loop (explicit + inferred facts, user-correctable).

**Exit criteria:** acceptance criteria 12-13, 15-16 pass.

## Phase 6 — Scan (photo scanning ✅, barcode not started)

- Photo-based pantry detection (AI vision — `ClaudeService.analyzeFoodPhoto`, `ScanModule`), always behind an explicit user-confirm-before-write step: `POST /scan/photo` only ever returns candidate items (Layer 3-validated via `scan-validation.ts`'s `sanitizeScannedItems`), nothing is written to `pantry_items` until the user reviews the list on `ScanScreen` and calls `POST /pantry/items` with the (possibly edited/trimmed) confirmed set. New `PantryItem` model (migration `20260826172848_add_pantry_items`, applied to the real Neon DB). Account-only, no guest access (same precedent as Plan Ahead — it builds a persisted, personal pantry). Deliberately has **no curated fallback** unlike Cook Today/Plan Ahead/Eat Now: a specific user's own photo can't be honestly faked with generic placeholder content, so with no `ANTHROPIC_API_KEY` this is a plain 503, not a demo-able stand-in. ✅ built and verified live: registered a real account, navigated Home → Scan, selected a real image file through the browser's actual file picker (`expo-image-picker`'s web implementation), confirmed the request reached `/scan/photo` and the app displayed the graceful "not configured yet" message — the same honest gate Cook Today had before its fallback was added.
- Not verified live: the review screen (checkbox per detected item, deselect before confirming) and the actual `/pantry/items` write from the UI, since both require real vision output and no `ANTHROPIC_API_KEY` exists in this environment. The `/pantry/items` endpoint itself *was* verified directly (bypassing the UI): posted items, got a real `pantry_items` row back, confirmed cascade-delete on account deletion. Flagging this gap honestly rather than claiming full UI verification.
- Barcode scanning (deterministic lookup, no AI vision needed) — not started; no product/barcode data source chosen yet, same open question as Eat Now's data source.
- Web equivalent — not built, per explicit MVP-focus direction this pass (camera/photo capture is a mobile-native capability first; web would only support file upload, no camera).

**Exit criteria:** no AI guess is ever persisted without confirmation — verified structurally (the DTO to `/pantry/items` takes the reviewed list itself, not a scan-result id, so there is no code path from "analysed" to "persisted" that skips the client's confirm step) and the persistence endpoint was verified directly; the full analyse → review → confirm loop through real vision output remains unverified pending an `ANTHROPIC_API_KEY`.

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
