# Risk Register

Severity: **P0** blocks launch · **P1** must fix pre-GA · **P2** monitor/post-launch

| ID | Risk | Category | Severity | Mitigation |
|---|---|---|---|---|
| R1 | Product/LLM implies a food is "safe" for an allergy or medical condition | Legal/Safety | P0 | Rules-engine output gate (L3) strips/replaces any suitability claim with fixed disclaimer language regardless of LLM output; AI eval suite tests this explicitly (§39). See [AI_SAFETY_POLICY.md](AI_SAFETY_POLICY.md). |
| R2 | User voluntarily discloses health information (special-category data under UK GDPR) via chat or "avoided ingredients" | Privacy/Legal | P0 | Treat any free-text field as potentially containing special-category data; encrypt at rest, exclude from default analytics export, flag for legal review before processing beyond storage/display. DPIA recommended pre-launch (§26). |
| R3 | LLM hallucinates ingredient/allergen/nutrition data not present in source data | Trust/Safety | P0 | LLM is only allowed to summarise/explain data retrieved from Layer 1 (structured food/product data); never allowed to invent ingredient lists. Output validated against source record before display. |
| R4 | Client-side trust of subscription/entitlement state enables premium-feature bypass | Security/Revenue | P0 | Entitlement checked server-side on every gated request; RevenueCat webhook is the only writer to `subscriptions`. |
| R5 | Location feature drifts into continuous background tracking | Privacy | P1 | Location permission requested only for Eat Now, foreground-only in MVP; explicit settings toggle; no location capability bundled into unrelated features. |
| R6 | Notification fatigue drives uninstalls (violates §37 "why does the user need this now") | Retention | P1 | Every scheduled notification type is tied to a concrete trigger condition (see [NOTIFICATION_STRATEGY.md](NOTIFICATION_STRATEGY.md)); user-level frequency caps and quiet hours enforced server-side, not just client preference. |
| R7 | Pantry/scan AI vision misidentifies items and silently updates inventory | Trust | P1 | Every scan result requires explicit user confirm/edit before any pantry write (§14) — enforced at the API layer, not just UI convention. |
| R8 | Prompt injection via scanned receipt text, restaurant menu data, or user chat input alters companion behaviour or leaks system prompt | Security | P1 | Treat all OCR/scanned/external text as untrusted data, never as instructions, in the LLM context; system prompt and rules-engine constraints are not user-overridable; covered by prompt-injection eval tests (§39). |
| R9 | Budget/shopping cost estimates presented as exact when source pricing data is stale or unavailable | Trust | P1 | Estimates are explicitly labelled "estimated" wherever underlying price data isn't confirmed; no fabricated savings figures (§21). |
| R10 | Third-party food/restaurant data licensing/availability in the UK is incomplete at launch | Product/Commercial | P2 | Eat Now MVP ships with whatever verified data source is licensed first (e.g. a single aggregator) rather than blocking on full national coverage; scope communicated in UX copy ("options near you" not "all options"). |
| R11 | App store review rejection due to health-adjacent claims in copy or screenshots | Commercial | P1 | All copy referencing allergies/health routed through the disclaimer language in §12 before submission; legal review gate before App Store/Play submission. |
| R12 | Over-collection of profile data violates data minimisation | Privacy | P1 | Onboarding only asks for goal category (§10) and optional preferences; nothing is mandatory beyond auth + a food/lifestyle goal. |

## Process
This register is reviewed at the end of every phase (Phase 0–8, §33) and before each production release (§27 production-readiness checklist).
