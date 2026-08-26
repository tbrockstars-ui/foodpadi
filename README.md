# FoodPadi

Your food companion that plans with you, not for you.

An AI-powered personal food companion for UK consumers, built around three primary modes — **Eat Now**, **Cook Today**, **Plan Ahead** — plus Scan, Shop, Remind, Adapt, and Learn. See [docs/PRODUCT_VISION.md](docs/PRODUCT_VISION.md) for the full product vision.

## Status

Phase 0 (documentation) and the first pass of Phase 1 (Foundation) are in place: auth, disclaimer acknowledgement, food/lifestyle goal selection, preferences/avoided ingredients, data export/deletion, and a Home screen shell. See [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md) for what's next.

## Repository Layout

```
apps/api/       NestJS + Prisma backend (Postgres via Neon) — see apps/api/README.md
apps/mobile/    Expo/React Native/TypeScript app — the only user-facing surface — see apps/mobile/README.md
apps/web/       Next.js landing page + staff-only admin/support page (no user-facing features) — see apps/web/README.md
packages/shared/ Shared TypeScript types/DTOs used across all three
docs/           Product, architecture, safety, privacy, and process documentation
```

Copy `.env.example` to `.env` at the repo root before running the API (Neon connection strings + JWT secrets).

## Documentation

All product, architecture, safety, privacy, and process documentation lives in [`/docs`](docs/):

| Doc | Purpose |
|---|---|
| [PRODUCT_VISION.md](docs/PRODUCT_VISION.md) | Positioning, core principle, moat |
| [PRODUCT_REQUIREMENTS.md](docs/PRODUCT_REQUIREMENTS.md) | Testable requirements by feature area |
| [USER_PERSONAS.md](docs/USER_PERSONAS.md) / [USER_JOURNEYS.md](docs/USER_JOURNEYS.md) / [UX_FLOWS.md](docs/UX_FLOWS.md) | Who this is for and how they move through it |
| [FEATURE_ROADMAP.md](docs/FEATURE_ROADMAP.md) / [MVP_SCOPE.md](docs/MVP_SCOPE.md) | What ships when |
| [TECHNICAL_ARCHITECTURE.md](docs/TECHNICAL_ARCHITECTURE.md) | Stack decisions and system architecture |
| [DATABASE_SCHEMA.md](docs/DATABASE_SCHEMA.md) | Relational schema proposal |
| [AI_ARCHITECTURE.md](docs/AI_ARCHITECTURE.md) / [AI_SAFETY_POLICY.md](docs/AI_SAFETY_POLICY.md) | How the LLM is bounded and supervised |
| [PRIVACY_DATA_MODEL.md](docs/PRIVACY_DATA_MODEL.md) / [SECURITY_MODEL.md](docs/SECURITY_MODEL.md) | UK GDPR and security posture |
| [NOTIFICATION_STRATEGY.md](docs/NOTIFICATION_STRATEGY.md) / [SUBSCRIPTION_MODEL.md](docs/SUBSCRIPTION_MODEL.md) | Reminders and monetisation |
| [ANALYTICS_PLAN.md](docs/ANALYTICS_PLAN.md) / [COMPETITIVE_STRATEGY.md](docs/COMPETITIVE_STRATEGY.md) | Metrics and market positioning |
| [RISK_REGISTER.md](docs/RISK_REGISTER.md) | Live risk tracking |
| [TEST_STRATEGY.md](docs/TEST_STRATEGY.md) | Test and AI-eval coverage requirements |
| [IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md) | Phase-by-phase build plan |
| [FOODPADI_LOGIN_ONBOARDING_RESEARCH.md](docs/FOODPADI_LOGIN_ONBOARDING_RESEARCH.md) | Competitor/Reddit/privacy research behind the login & onboarding decision |
| [FOODPADI_ONBOARDING_SPEC.md](docs/FOODPADI_ONBOARDING_SPEC.md) / [FOODPADI_AUTHENTICATION_SPEC.md](docs/FOODPADI_AUTHENTICATION_SPEC.md) | Onboarding flows and auth architecture (guest mode, Apple/Google sign-in) |
| [FOODPADI_PERSONALISATION_SPEC.md](docs/FOODPADI_PERSONALISATION_SPEC.md) / [FOODPADI_ONBOARDING_ANALYTICS.md](docs/FOODPADI_ONBOARDING_ANALYTICS.md) | Progressive personalisation and onboarding funnel analytics/A-B tests |

## Non-Negotiable Boundary

FoodPadi does not monitor allergies, diagnose medical conditions, or determine whether food is medically safe. See [AI_SAFETY_POLICY.md](docs/AI_SAFETY_POLICY.md).
