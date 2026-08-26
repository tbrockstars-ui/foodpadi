# FoodPadi Progressive Personalisation Specification

Implements [FOODPADI_LOGIN_ONBOARDING_RESEARCH.md](FOODPADI_LOGIN_ONBOARDING_RESEARCH.md) §11 (privacy) and §17 (required/optional/progressive/never-collected data), and extends the existing memory model in [AI_ARCHITECTURE.md](AI_ARCHITECTURE.md) §"Memory Model" rather than replacing it.

## Principle

FoodPadi should feel like it's learning about the user through use, not interrogating them at setup. Every piece of progressive data collection below is triggered by something the user just did, and is always confirmable, editable, and forgettable — never silently assumed as fact.

## What's Already Built

- `food_preferences` (cuisine, liked meal, disliked ingredient, texture dislike, cooking style) — API CRUD exists (`apps/api/src/modules/preferences/`), no mobile UI yet beyond the API.
- `avoided_ingredients` — API CRUD exists, framed correctly as "foods I choose to avoid," never medical. No mobile UI yet.
- `ai_memory` (`apps/api/prisma/schema.prisma`) — curated, user-visible facts with a `source` field (`'explicit' | 'inferred'`) and a `confidence` field, already designed for exactly the explicit-vs-inferred distinction this spec needs. Not yet written to or read from by any real feature (Phases 2-5 unbuilt).
- `food_goals` — single active goal, replace-on-write (`GoalsService.setGoal`), API-complete.

**This spec is primarily about sequencing when these already-modelled fields get populated, and the confirmation UX around `ai_memory`'s inferred facts — not new schema.**

## Progressive Collection Timeline

| Session | What's collected | Trigger | Field(s) |
|---|---|---|---|
| Onboarding (account creation) | Nothing required beyond email/password | — | — |
| Onboarding (optional, skippable) | Food/lifestyle goal | `GoalScreen`, now skippable | `food_goals` |
| First Eat Now/Cook Today use | Budget, cuisine, time constraint — but only as **session input**, not saved preference, unless the user explicitly says to remember it | Typed/spoken into the request itself | Not persisted by default |
| First "Save" action | Whatever made this result worth saving (an implicit positive signal) | Tapping Save | `meal_feedback` (Phase 2+), optionally offered as "add to favourite cuisines?" |
| First Plan Ahead use | Planning scope (required — it's the feature's actual input) + goal if still unset | Plan Ahead flow | `meal_plans.scope`, `food_goals` |
| Any point, explicit | "Remember this as one of my favourites" / "Forget that I like this" (already a named requirement in the product spec, §9) | User-initiated chat/UI action | `ai_memory` (source: `'explicit'`) |
| Ongoing, inferred | Repeated behaviour (e.g., consistently skipping a cuisine) | Passive, from `food_events`/`meal_feedback` | `ai_memory` (source: `'inferred'`, with `confidence`) — **never surfaced as fact until confirmed** |

## Confirmation UX for Inferred Facts

Per the product spec's own requirement ("the system must not infer sensitive medical information unnecessarily" and the explicit `[Review] [Edit] [Forget]` control pattern), any `ai_memory` row with `source = 'inferred'` is:

1. **Never used to make a user-facing claim as if it were confirmed** ("You don't like mushrooms" is not stated as fact) until confirmed.
2. **Surfaced for confirmation at a natural moment**, not as an interruption — e.g., inline in the companion card: *"Noticed you've skipped mushroom recipes a few times — avoid these going forward?"* with `[Yes, avoid it] [No, that's fine] [Don't ask again]`.
3. **Given equal weight in the UI to explicit facts once confirmed** — after confirmation, `source` effectively becomes user-endorsed even if originally inferred (implementation: keep `source: 'inferred'` for provenance, but the confirmation itself is logged, and confirmed inferred facts are weighted like explicit ones in ranking — no new field required, `updated_at` + a `confirmedAt`-style marker is sufficient if needed later).

## User Controls

Already required by the product spec, not new: **view, edit, export, delete** the whole food profile (`GET/DELETE /users/me`, `/users/me/export` already implemented), plus per-fact deletion (`DELETE /users/me/preferences/:id`, `/users/me/avoided-ingredients/:id` already implemented). The **remaining gap** is `ai_memory` itself has no controller/endpoints yet — needed before any inferred-memory feature ships:

- `GET /users/me/memory` — list all memory facts (explicit + inferred, with source/confidence visible)
- `DELETE /users/me/memory/:id` — "forget this"
- `PATCH /users/me/memory/:id` — correct a fact rather than delete-and-recreate

These mirror the existing `preferences`/`avoided-ingredients` controller pattern exactly (`apps/api/src/modules/preferences/`) — same shape, new module (`apps/api/src/modules/memory/`), not a new pattern to design.

## What Personalisation Never Does

- Never infers or asks about medical conditions, allergies-as-diagnosis, or body metrics (weight/height/BMI) — consistent with Decision 10-13 and the special-category-data finding in the research doc §11.
- Never blocks a core interaction (Eat Now/Cook Today) pending a personalisation question — personalisation augments the answer, it never gates it.
- Never silently changes a stated preference based on inference alone — inference proposes, the user confirms.

## Backlog

**P1 (needed once Phase 2/5 features exist, per [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md)):**
- `ai_memory` controller/endpoints (list/delete/edit) — small, mirrors existing pattern.
- Companion-card confirmation UI component for inferred facts (`[confirm] [dismiss] [don't ask again]`).

**P2:**
- "Remember this as a favourite" quick-action wired into Cook Today/Eat Now result screens once those exist.
- Contextual goal re-ask inside Plan Ahead if still unset (cross-reference: [FOODPADI_ONBOARDING_SPEC.md](FOODPADI_ONBOARDING_SPEC.md) Backlog P2).
