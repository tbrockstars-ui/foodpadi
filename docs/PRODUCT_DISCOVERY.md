# Product Discovery — Current State

**Date:** 2026-08-25
**Status:** FoodPadi is a greenfield project. No prior code, schema, or infrastructure exists.

## 1. Repository Inspection Findings

| Area | Finding |
|---|---|
| Technology stack | None present. `C:\Users\kcnwa\Desktop\UKIVA\FoodPadi` was an empty directory. |
| Architecture | None. |
| Database | None. |
| Authentication | None. |
| UI / components | None. |
| APIs | None. |
| AI integration | None. |
| Payments / subscription | None. |
| Deployment | None. |
| Security controls | None. |
| Analytics | None. |
| Technical debt | N/A — nothing to inherit. |

**Git note:** the directory was not its own repository — it was nested inside a git repo rooted at the Windows user profile (`C:\Users\kcnwa`), which would have mixed unrelated personal files (credential configs, browser caches, `NTUSER.DAT`) into any commit. A dedicated repository has been initialized at the project root (`FoodPadi/.git`) to fix this before any code is written.

## 2. What This Means for Process

Because there is no existing implementation to assess for reuse or conflict, Phase 0 collapses to two real decisions this document and its companions make explicit:

1. **Technology stack** — see [TECHNICAL_ARCHITECTURE.md](TECHNICAL_ARCHITECTURE.md). No existing stack constrains the choice, so the recommendation is driven purely by the product's requirements (cross-platform mobile, structured relational data, deterministic business rules separated from an LLM layer, RLS-grade data isolation, remotely configurable subscription pricing).
2. **Scope sequencing** — see [MVP_SCOPE.md](MVP_SCOPE.md) and [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md). The spec is large (a full companion product, not a recipe app); this project will be built in the phases the spec itself defines (Phase 0 → Phase 8), not all at once.

## 3. Immediate Risks Identified Pre-Code

These are elevated to [RISK_REGISTER.md](RISK_REGISTER.md) but worth surfacing here because they affect Phase 0/1 decisions directly:

- **Allergy/medical boundary** is a legal and trust-critical constraint, not a copy nit — it must be enforced in the rules engine (Layer 3), not left to the LLM to self-censor. See [AI_SAFETY_POLICY.md](AI_SAFETY_POLICY.md).
- **UK special-category data**: any voluntarily-disclosed health information (e.g. "I avoid X because of my condition") must be recognised and handled as potential special-category data under UK GDPR even though the product never asks for it. See [PRIVACY_DATA_MODEL.md](PRIVACY_DATA_MODEL.md).
- **Subscription pricing must be server-configured**, not hard-coded, from the first commit that touches billing — retrofitting this later is expensive.

## 4. Conclusion

FoodPadi starts from a clean slate. No existing-code discovery backlog is needed. Proceeding directly to architecture, schema, and MVP definition, per the spec's own Phase 0 exit criteria.
