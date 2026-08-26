# FoodPadi Onboarding Specification

Implements the decision in [FOODPADI_LOGIN_ONBOARDING_RESEARCH.md](FOODPADI_LOGIN_ONBOARDING_RESEARCH.md). This spec describes the target state and the specific, incremental changes to the existing codebase required to reach it — it does not propose rewriting what's already built.

## Current State (as implemented today)

- `apps/mobile/src/navigation/RootNavigator.tsx`: a strict linear gate — no user → `AuthFlow`; user but `!disclaimerAcknowledgedAt` → `DisclaimerScreen`; `!onboardingCompletedAt` → `GoalScreen`; else → `HomeScreen`.
- `apps/mobile/src/screens/GoalScreen.tsx`: forces a selection before "Continue" is enabled — there is no skip path today.
- `apps/api/src/modules/users/users.service.ts`: `completeOnboarding` requires `disclaimerAcknowledgedAt` to already be set.
- Eat Now, Cook Today, and Plan Ahead are **stub cards only** on `HomeScreen` — no real feature logic exists yet (Phases 2-4 of [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) are unbuilt).
- No guest/anonymous session concept exists anywhere in the API today.

This matters for phasing: the auth/onboarding **architecture** below can be built now; the full "guest gets a real Eat Now answer" experience is gated on Phase 2/4 feature work landing. The backlog at the end of this doc sequences both honestly.

## Target Onboarding Model

### Guiding rule
No screen exists solely to collect data "just in case." Every question asked has to unlock something the user is about to do, right now.

### Two entry paths

**Path 1 — Eat Now / Cook Today (guest-accessible)**

```
Home ("What do you need today?")
  → tap Eat Now or Cook Today
  → [if first time and no session yet] lightweight guest session created silently (no UI, no form)
  → [safety disclaimer footer shown inline wherever food/ingredient info appears — not a blocking modal, see below]
  → conversational input / quick chips
  → real result (recommendation or recipe)
  → action row: [Cook it] [Save] [Start over]
  → tapping [Save] (or any other persistence action) → signup prompt (see "Signup Trigger" below)
```

**Path 2 — Plan Ahead (account-first)**

```
Home → tap Plan Ahead
  → [no existing account] → AuthFlow (register/login)
  → 1-2 short questions: food/lifestyle goal (optional/skippable) + planning scope (Today/3-day/Week/Custom — required, it's the actual input to the feature, not a profiling question)
  → first draft plan generated
  → Home
```

### The disclaimer is not skipped for guests

The allergy/medical safety boundary (§11 of the product spec, [AI_SAFETY_POLICY.md](AI_SAFETY_POLICY.md)) applies regardless of account state. For guest sessions, the disclaimer is shown once per session as a lightweight, dismissible (not blocking-forever) inline notice the first time ingredient/allergen information is about to be displayed — logged server-side against the guest session ID for audit purposes, same principle as `disclaimerAcknowledgedAt` for registered users. This is a new, small piece of guest-session state, not a new legal framework.

### Signup trigger — exact moment

Registration is prompted at the **first persistence-requiring action**, specifically:
- Tapping "Save" on an Eat Now result or Cook Today recipe
- Tapping "Remember this" / "Add to favourites" on any result
- Opening Plan Ahead at all (since the whole feature is persistence)
- Turning on any reminder
- Adding an item to a shopping list

Not: app open, not a fixed "after 3 free uses" counter (that can be tested later as a growth experiment per [FOODPADI_ONBOARDING_ANALYTICS.md](FOODPADI_ONBOARDING_ANALYTICS.md), but is not the default/required trigger).

When triggered, the signup prompt should carry context, not be a generic wall:

> "Want to save this? Create a free account and FoodPadi will remember it for next time."

not:

> "Please sign up to continue."

### GoalScreen becomes skippable

`GoalScreen` keeps its existing UI and options, but gains a "Skip for now" affordance alongside "Continue." Skipping still calls `completeOnboarding` (onboarding is "complete" the moment the disclaimer is acknowledged — a goal is not a completion gate). The goal can be asked again later, contextually, inside Plan Ahead's first use if still unset (see [FOODPADI_PERSONALISATION_SPEC.md](FOODPADI_PERSONALISATION_SPEC.md)).

## First-Time User Journey, Per Intent

**A. Eat Now**
```
Open app → Home (no login needed to reach Home in guest mode — see note below)
→ tap Eat Now → "What are you after?" (free text/chips: budget, cuisine, distance, time)
→ ranked results (2-4 options)
→ [Cook it via a linked recipe / Save / Start over]
→ Save → signup prompt (contextual, as above)
```
Note: since `HomeScreen` currently sits behind the auth gate entirely, allowing guest access to Eat Now/Cook Today requires `RootNavigator` to render a **guest-capable Home** (a reduced Home showing only Eat Now/Cook Today as live, Plan Ahead/Scan shown but tapping them triggers the signup prompt) when no user and no guest-session-with-declined-signup state exists. See Backlog P0/P1 below for the exact navigator change.

**B. Cook Today**
```
Open app → Home → tap Cook Today
→ "What have you got?" (ingredient chips, optional time constraint)
→ 2-3 recipe options
→ [Start cooking / Save / Start over]
→ Save or "Start Cook Mode" for a multi-step recipe → signup prompt
```
(Cook Mode's step-by-step state is itself a reason to persist — a half-finished cook session is worth resuming, which is a legitimate, contextual signup moment, not an arbitrary one.)

**C. Plan Ahead**
```
Open app → Home → tap Plan Ahead → AuthFlow if no account
→ (post-auth) DisclaimerScreen if not yet acknowledged
→ short screen: planning scope (Today/3-day/Week/Custom) + optional goal
→ first plan generated → Home
```

## Returning User Journey

- **Returning guest** (no account, has a prior guest session): Home loads directly into guest-capable state; no re-prompt for the disclaimer within the same device/session window (already logged); Eat Now/Cook Today work immediately.
- **Returning registered user**: standard session refresh via existing `AuthContext.refreshUser()` (`apps/mobile/src/auth/AuthContext.tsx`) — already implemented, no change needed. Lands on `HomeScreen` directly if disclaimer + onboarding are already complete.
- **Returning user who skipped the goal**: Home behaves normally; the goal may be asked again once, contextually, the first time Plan Ahead is opened if still unset — never re-asked on every Home visit.

## Wireframe Descriptions

**Guest-capable Home** (new, replaces today's hard gate for the guest case):
```
[ What do you need today? ]

[ EAT NOW ]        [ COOK TODAY ]
 live, no lock       live, no lock

[ PLAN AHEAD ]     [ SCAN ]
 tapping prompts     tapping prompts
 signup              signup

(no "Your companion" card in guest mode — that card's content
 requires memory, which requires an account)

[ small, persistent "Log in / Create account" affordance,
  not a blocking banner ]
```

**Contextual signup prompt** (new component, used from multiple trigger points):
```
[ Save this for next time? ]
"Create a free account and FoodPadi will remember it."

[ Create account ]   [ Log in ]   [ Not now ]
```
"Not now" returns the user to exactly where they were, result intact, nothing lost — this is important: declining must never discard the guest's in-progress result.

**GoalScreen** (modified — one addition):
```
What is your food & lifestyle goal?
[ ...existing 9 options, unchanged... ]

[ Continue ]         [ Skip for now ]   <- new
```

## Backlog & Phasing

**P0 (launch blocker for the onboarding change itself):**
- Add "Skip for now" to `GoalScreen`; skipping calls `completeOnboarding` without a prior `setGoal` call. (Small, mobile-only change plus confirming the API doesn't require a goal to exist before `completeOnboarding` — it doesn't today.)
- Add a guest-session concept to the API (see [FOODPADI_AUTHENTICATION_SPEC.md](FOODPADI_AUTHENTICATION_SPEC.md)) — required before any guest-mode UI work is meaningful.
- Contextual signup-prompt component (mobile), reusable across trigger points.

**P1 (MVP, sequenced with Phase 2-4 feature work — cannot fully land before Eat Now/Cook Today exist):**
- Guest-capable `HomeScreen` variant + `RootNavigator` branch for "no user, has/creates guest session."
- Wire the signup trigger into the real Eat Now "Save" and Cook Today "Save"/"Start Cook Mode" actions once those features exist (Phase 2/4).
- Disclaimer-for-guest-sessions logging (extends the existing disclaimer-acknowledgement pattern to a guest-session ID rather than a `user_id`).
- Plan Ahead's short post-signup preference step (planning scope + optional goal).

**P2 (post-MVP):**
- "After N free guest interactions" as an A/B-tested alternative signup trigger (see [FOODPADI_ONBOARDING_ANALYTICS.md](FOODPADI_ONBOARDING_ANALYTICS.md)) — not a default, only if data supports it.
- Contextual goal re-ask inside first Plan Ahead use if still unset.

**P3 (future):**
- Guest-to-account data migration if a guest interacts extensively before converting (currently guest sessions are intentionally ephemeral/non-persistent, so there is nothing to migrate under the P0/P1 design — this only becomes relevant if a future guest experience starts caching more session state client-side).
