# Test Strategy

## Functional/Backend Test Coverage (§39)

Automated tests required for:
- Authentication and authorization (including negative cases: cross-user data access attempts)
- Profile CRUD
- Planning (create, swap-one-meal-only, regenerate-one-meal-only, scope changes)
- Budget calculations (deterministic; LLM narration must match these exactly — a mismatch is a bug, not an LLM quirk)
- Ingredient consolidation (shopping list generation from overlapping recipes)
- Shopping list generation and editing
- Meal swapping/regeneration
- Reminder scheduling and preference enforcement (quiet hours, frequency caps, opt-out)
- Subscription entitlement checks (every gated endpoint, both directions: premium user gets access, free user is blocked)
- Safety boundary enforcement (allergy/medical claim filter — see below)
- Data deletion (account deletion actually removes data within policy; memory fact deletion is a real delete)
- Data access (export produces complete, correct data; a user cannot fetch another user's data)
- AI output validation (structural sanity checks on generated recipes/plans)

## AI Evaluation Suite (§39, mirrors [AI_SAFETY_POLICY.md](AI_SAFETY_POLICY.md))

A standing eval suite, run on every model/prompt change before deploy, covering:
- Hallucination (ingredient/allergen/price facts not present in source data)
- Unsafe medical claims (direct and leading/indirect phrasing)
- Allergy safety claims under adversarial rephrasing
- Prompt injection (via chat, scanned/OCR text, menu data)
- Inappropriate recommendations (e.g. suggestion exceeds stated budget but is framed as within it)
- Contradictory preference handling
- Budget calculation errors (LLM-narrated number vs. Layer 3 computed number)
- Invalid ingredients (unrecognised/nonsense ingredient names)
- Impossible recipes (negative time, zero servings, missing steps)
- Duplicate ingredients in a single recipe

**Any failure in the medical-claim or allergy-safety categories blocks release — no exceptions, no severity downgrade.**

## Non-Functional Testing (Phase 8, §33 production hardening)

- Security review (authZ boundary testing, data-leakage testing, secrets exposure check)
- Privacy review (data minimisation audit, special-category data handling audit)
- Performance testing (API latency under load, especially Eat Now/Cook Today generation paths)
- Accessibility testing (WCAG 2.2 AA — screen reader pass, contrast check, keyboard/switch navigation)
- Mobile testing on real iOS and Android devices, not simulator-only
- Error handling / observability validation (errors actually surface in Sentry with useful context, without leaking sensitive payloads)
- Analytics validation (event volumes sane, north-star metric computable end-to-end)
- Cost monitoring validation (AI cost-per-user figure is actually being computed correctly)
- Abuse testing (rate limits hold under scripted abuse)

## Test Pyramid

- Unit tests: rules engine (budget math, entitlement checks, safety filter logic), data validation — fast, run on every commit.
- Integration tests: API endpoints against a real test database — run on every PR.
- E2E tests: critical user journeys (§40 acceptance criteria 1-20) via a small number of high-value scripted flows, not exhaustive UI coverage.
- AI eval suite: run on every prompt/model change and on a schedule (data drift), separate from the standard CI unit/integration gate given its cost and latency.

## Release Gate

A release ships only if: all P0 tests pass, the AI eval suite has zero failures in the medical/allergy categories, and the [RISK_REGISTER.md](RISK_REGISTER.md) has no open P0 items.
