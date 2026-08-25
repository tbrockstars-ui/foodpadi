# FoodPadi

Your food companion that plans with you, not for you.

An AI-powered personal food companion for UK consumers, built around three primary modes — **Eat Now**, **Cook Today**, **Plan Ahead** — plus Scan, Shop, Remind, Adapt, and Learn. See [docs/PRODUCT_VISION.md](docs/PRODUCT_VISION.md) for the full product vision.

## Status

Pre-implementation. Phase 0 (product discovery, architecture, and planning documentation) is complete. See [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md) for the phased build plan and current position.

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

## Non-Negotiable Boundary

FoodPadi does not monitor allergies, diagnose medical conditions, or determine whether food is medically safe. See [AI_SAFETY_POLICY.md](docs/AI_SAFETY_POLICY.md).
