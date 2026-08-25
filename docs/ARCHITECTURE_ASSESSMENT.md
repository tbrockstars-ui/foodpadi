# Architecture Assessment

## Current State
No existing implementation (see [PRODUCT_DISCOVERY.md](PRODUCT_DISCOVERY.md)). This assessment therefore evaluates the **proposed** target architecture against the spec's constraints, since there is nothing legacy to grade.

## Gap Analysis: Spec Requirement → Architectural Answer

| Spec requirement | Architectural answer |
|---|---|
| §23 LLM must not control deterministic logic | 6-layer backend (Layers 1-6), rules engine (L3) sits between memory (L2) and the LLM (L5); LLM output passes through L3/L6 validation before reaching the client. |
| §25 Never trust the client / no exposed keys | All AI, DB-service-role, and payment-secret calls are backend-only. Mobile app authenticates via short-lived session tokens. |
| §24 Relational schema with FKs, soft deletion, timestamps | Postgres + Prisma migrations; every table gets `created_at`, `updated_at`, and `deleted_at` (nullable) per §24 convention — see [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md). |
| §11 Allergy/medical boundary is non-negotiable | Implemented as a rules-engine gate (L3) that intercepts any output mentioning safety/suitability and replaces it with the fixed disclaimer language, regardless of what the LLM generated. Covered by AI eval tests (§39). |
| §20/§21 Remote-configurable pricing | Entitlements table + RevenueCat product config, no price literals in app code. |
| §28 Location optional, no continuous tracking | Location is read on-demand for Eat Now requests only; no background location permission requested in MVP. |
| §36 Short-term vs long-term AI memory | `ai_conversations` (ephemeral, TTL-purged) vs `ai_memory` (curated, user-editable) as distinct tables — see schema. |
| §38 Admin/analytics without exposing sensitive data | Analytics events reference user IDs, not raw profile content; admin views aggregate, not per-user PII dumps, by default. |

## Recommendation

Proceed with the stack in [TECHNICAL_ARCHITECTURE.md](TECHNICAL_ARCHITECTURE.md) and the phased plan in [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md). No architectural blockers identified — the main risks are product/legal (allergy boundary, special-category data), not technical, and are tracked in [RISK_REGISTER.md](RISK_REGISTER.md).
