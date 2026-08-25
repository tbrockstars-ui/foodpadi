# MVP Scope

Per spec §32, with priorities per §45 (P0 = launch blocker, P1 = MVP, P2 = post-MVP, P3 = future).

**Platform scope (user decision):** the mobile app (iOS/Android, Expo) is the only user-facing surface. The web application (`apps/web`) is limited to a public landing page (directs visitors to install the app) and a staff-only admin/support page — never a customer-facing web version of Eat Now/Cook Today/Plan Ahead/etc. See [TECHNICAL_ARCHITECTURE.md §2.7](TECHNICAL_ARCHITECTURE.md#27-web-surface--landing-page--admin-support-page-only).

## In Scope (MVP)

| # | Feature | Priority | Notes |
|---|---|---|---|
| 1 | Authentication (email + Apple/Google sign-in) | P0 | Session-based, backend-issued tokens |
| 2 | User profile | P0 | Minimal required fields |
| 3 | Food preferences | P1 | Optional, editable anytime |
| 4 | Food/lifestyle goals (§10) | P1 | Non-medical goal set only |
| 5 | Eat Now | P0 | Core differentiator; location optional |
| 6 | Cook Today | P0 | Core differentiator; ingredient-driven |
| 7 | Plan Ahead (Today / 3-day / Week / Custom) | P0 | No forced weekly plan |
| 8 | Meal editing/swapping | P1 | Single-meal regeneration, not full replan |
| 9 | Shopping list | P1 | Generated from accepted plan only |
| 10 | Basic reminders | P1 | Small, justified set — not the full engine |
| 11 | AI companion chat | P1 | Backed by 6-layer architecture |
| 12 | Food information display | P0 | Ingredient/allergen info display, no safety claims |
| 13 | Safety disclaimer (§12) | P0 | Onboarding + settings + inline at relevant moments |
| 14 | Privacy controls | P0 | View/edit/export/delete profile & memory |
| 15 | Feedback (meal liked/disliked etc.) | P1 | Feeds Personal Food Memory |
| 16 | Subscription foundation | P1 | Entitlement model + RevenueCat, free tier fully usable |
| 17 | Analytics | P1 | North star + supporting metrics from day one |
| 18 | Admin/error monitoring | P1 | Sentry + basic internal metrics view |

## Explicitly Out of Scope for MVP

Per §32 and reinforced by §14/§47 (these are V2+):

- Medical nutrition therapy, allergy monitoring, diagnosis
- Autonomous purchasing of any kind
- Social network features
- A large proprietary recipe database (we use structured data + LLM generation/adaptation, not a content library as the moat)
- Full integration with every UK supermarket
- Automatic pantry quantity inference without user confirmation
- Wearable integrations
- Receipt scanning, fridge scanning, full pantry intelligence (Phase 6 / V2 — barcode scan may land in MVP-adjacent Phase 6 if time allows, but is not a launch blocker)

## MVP Acceptance Test

The 20 acceptance criteria in spec §40 are the MVP's Definition of Done — each is mapped to a test in [TEST_STRATEGY.md](TEST_STRATEGY.md).
