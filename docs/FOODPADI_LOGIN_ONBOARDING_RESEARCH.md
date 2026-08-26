# FoodPadi Login & Onboarding Research and Decision

**Date:** 2026-08-26
**Author:** Product/UX/Security analysis, informed by live competitor research, Reddit sentiment research, and conversion/privacy benchmark research (see Methodology).
**Status:** Decision made. This document is the evidence base; [FOODPADI_ONBOARDING_SPEC.md](FOODPADI_ONBOARDING_SPEC.md), [FOODPADI_AUTHENTICATION_SPEC.md](FOODPADI_AUTHENTICATION_SPEC.md), [FOODPADI_PERSONALISATION_SPEC.md](FOODPADI_PERSONALISATION_SPEC.md) and [FOODPADI_ONBOARDING_ANALYTICS.md](FOODPADI_ONBOARDING_ANALYTICS.md) are the implementation specs derived from it.

## Methodology

This report is based on three research passes, each using live web search (not invention):
1. **Competitor onboarding research** — Mealime, Samsung Food, AnyList, Paprika, Plan to Eat, Eat This Much, MyFitnessPal, Yummly, BBC Good Food, a UK supermarket app, and ChatGPT/Gemini/Perplexity as general AI assistants.
2. **Reddit sentiment research** — an honest attempt at real user sentiment via web search of Reddit.
3. **Conversion, authentication, and privacy/GDPR benchmark research.**

Every claim below is tagged **VERIFIED** (has a citable source), **INDUSTRY CONSENSUS** (widely repeated, no single primary source traced), or **UNVERIFIED/NOT FOUND**. Where research came back thin, that is stated explicitly rather than papered over — this matters most for section 4 (Reddit), where direct access to Reddit was blocked and search-index coverage of this specific topic turned out to be poor. That limitation does not invalidate the decision; it means the decision leans more heavily on the competitor and privacy/conversion evidence, which was strong, and treats the Reddit-derived psychology as directionally plausible rather than statistically established.

---

## 1. Executive Summary

FoodPadi should NOT copy its current implementation's actual behaviour (login required before anything, including before seeing the app's core modes). Nor should it copy the "long questionnaire before any value" pattern used by Eat This Much/MyFitnessPal/Noom, which competitor evidence shows works only when paired with an immediate, visibly personalized payoff, and backfires badly when it reads as a stalling tactic (Noom's FTC settlement is the cautionary case).

**Recommendation: a refined progressive/hybrid model (Option C), split by FoodPadi's own three intents** — not a generic "let everyone browse for a while" approach:
- **Eat Now and Cook Today** can be used as a guest, because their output (a suggestion, a recipe) is not itself a thing that needs saving to have value — this mirrors how ChatGPT/Gemini/Perplexity and Paprika all let users get a real answer with zero account (VERIFIED), and matches the plain logic that these are the two high-urgency, low-patience intents (§7).
- **Plan Ahead requires an account near the start**, because a "plan" is inherently a persistent artifact — there is nothing to show a guest that isn't the exact thing that would need an account to save. This matches why Samsung Food, AnyList, Eat This Much, and MyFitnessPal all gate on account creation (VERIFIED): their value *is* a saved, personalized artifact, not a one-off answer.
- **Account creation is triggered by the first action that requires persistence** — saving a meal, starting a plan, turning on a reminder, adding to a shopping list — not by opening the app.
- **Preferences are collected progressively**, never as a mandatory upfront block, and are framed as taste/behaviour preferences only, never medical/allergy — this is not just a UX preference but tracks a real, citable UK GDPR distinction (§11).

This is a change from FoodPadi's current build, where every screen (including the stub Eat Now/Cook Today/Plan Ahead cards) sits behind a mandatory login → disclaimer → goal-selection sequence. See [FOODPADI_ONBOARDING_SPEC.md](FOODPADI_ONBOARDING_SPEC.md) for the specific, file-level changes this implies.

---

## 2. FoodPadi's User Problem

FoodPadi's own positioning ("your food companion that plans with you, not for you," see [PRODUCT_VISION.md](PRODUCT_VISION.md)) is in direct tension with any onboarding pattern that makes the first experience feel like paperwork. A companion that opens with a login wall, a disclaimer wall, and a mandatory goal-picker before doing anything is behaving like an enterprise SaaS tool, not a companion — regardless of how good the eventual product is.

At the same time, FoodPadi's actual moat (per [PRODUCT_VISION.md](PRODUCT_VISION.md) and [AI_ARCHITECTURE.md](AI_ARCHITECTURE.md)) is the **Personal Food Graph** — persistent memory, preferences, and behaviour tied to an identity. That moat cannot exist without an account *at some point*. The problem is not "should FoodPadi ever ask for an account" — it obviously must, to deliver on its own differentiation — the problem is **when**, and **what must be true before that ask feels earned rather than presumed**.

---

## 3. Competitor Research

### 3.1 Per-app findings

| App | Login required before value? | Guest/browse possible? | When is account requested? | When are preferences collected? | Social login |
|---|---|---|---|---|---|
| **Mealime** | UNVERIFIED exact gate | App described as free to download/use before Pro upgrade | UNVERIFIED exact moment | Believed to be during onboarding (diet, allergies, household size, cook time) but exact flow UNVERIFIED | UNVERIFIED |
| **Samsung Food** (formerly Whisk) | **Yes** — account required immediately after install (VERIFIED) | No guest mode found | Before any use | Immediately after login, before first use: diet, avoidances, dislikes, nutrition needs, household size, preferred store (VERIFIED) | Google, Facebook, Apple, Samsung Account (VERIFIED) |
| **AnyList** | **Yes** — account required to use the app at all (VERIFIED) | No | Before any use | Minimal — it's a list app, not a preference-driven planner | UNVERIFIED |
| **Paprika** | **No** — fully usable locally with zero account (VERIFIED) | Yes — full local use | Only when the user opts into Cloud Sync | No preference/taste profile feature exists | N/A |
| **Plan to Eat** | Yes, but with a 14-day free trial and no payment info required (VERIFIED) | No | Before use | Recipe tags/dietary notes appear added progressively as plans are built, not front-loaded (UNVERIFIED in detail) | UNVERIFIED |
| **Eat This Much** | Signup needed (email only) (VERIFIED) | No | Before use | Full quiz (stats, diet, goals, budget, schedule) completed **during** signup, before any plan is shown (VERIFIED) | UNVERIFIED |
| **MyFitnessPal** | Yes (VERIFIED) | No | Before use | ~5-6 questions (activity, gender, birthdate, goal, height, weight) before a personalized calorie target is shown (VERIFIED) | Google, Facebook, Apple (VERIFIED) |
| **Yummly** | N/A — **shut down permanently in December 2024** (VERIFIED) | — | — | — | — |
| **BBC Good Food (app)** | Appears to be a subscription/paywall model (VERIFIED description found); whether any free browsing exists pre-payment is UNVERIFIED | Partially unverified | UNVERIFIED | UNVERIFIED | UNVERIFIED |
| **Tesco (UK supermarket)** | Recipe/meal-plan personalization runs on existing shopping-history/account data (VERIFIED); whether the recipes site itself requires login is UNVERIFIED | Recipes site likely browsable but unconfirmed | Personalization tied to existing grocery account | Tied to shopping history, not a dedicated quiz | N/A |
| **ChatGPT** | **No** — explicit guest mode, ~10 messages/5hrs on flagship model then auto-downgrade, no hard cap (VERIFIED) | Yes, full guest access to real answers | Only for persistence/history/higher usage | N/A | N/A |
| **Gemini** | **No** on web (confirmed guest access to base "Flash" model, even incognito); **Yes** on the mobile app (VERIFIED) | Yes on web only | For advanced models, file upload, Deep Research, personalization, history | N/A | N/A |
| **Perplexity** | **No** — basic search works without an account, "effectively unlimited" on free tier (VERIFIED); Pro Search capped ~5/day for guests | Yes | For advanced search / higher usage | N/A | N/A |

### 3.2 The pattern

Two clean clusters emerge, and FoodPadi should recognise which cluster each of its three modes belongs to:

- **"The value IS a saved artifact" apps** (Samsung Food, AnyList, Eat This Much, MyFitnessPal) require an account almost immediately, and earn it by delivering a personalized artifact (a meal plan, a calorie target) right after a short (5-8 question) quiz. This is structurally the same shape as FoodPadi's **Plan Ahead**.
- **"The value is a one-off answer" apps/assistants** (Paprika for local use, ChatGPT, Gemini, Perplexity) let users get a real, complete answer with zero account, gating only sync, higher usage, or persistence behind login. This is structurally the same shape as FoodPadi's **Eat Now** and **Cook Today**.

No competitor researched runs a single onboarding model across genuinely different task types the way FoodPadi's three-intent design does — which is itself the argument for *not* copying any single competitor's onboarding wholesale, and instead applying the right cluster's pattern to the right FoodPadi mode.

### 3.3 General UX/conversion benchmarks found

- **MyFitnessPal**: ~18-step onboarding, ends in a personalized dashboard before any food logging (VERIFIED, Pageflows/Propel teardowns).
- **Noom**: up to 113 screens over 10-15 minutes before showing pricing — documented as a deliberate sunk-cost/engagement tactic, and a contributing factor in a **$62M FTC settlement** over subscription practices (VERIFIED via multiple press sources). This is the clearest cautionary tale available: long, manipulative-feeling onboarding is a legal and trust risk, not just a conversion one.
- Baymard Institute maintains a large signup-friction research program, but the specific quantitative benchmarks are paywalled — any specific percentage attributed to Baymard beyond their public summary should be treated as unverified.
- Nielsen Norman Group's progressive disclosure concept is real and repeatedly published (VERIFIED as a concept), but a specific numeric form-length-vs-abandonment study for mobile signup was not located (concept verified, exact numbers not).
- Numerous specific percentages circulating in growth-marketing content (e.g. "signup walls lose 20-40% of users," "7→3 fields cuts abandonment 44.7%") could not be traced to a primary dataset. **Treat directionally only** — the direction (friction hurts conversion) is well supported; the precise numbers are not.

---

## 4. Reddit User Sentiment

**Read this section's caveat first:** direct fetches of reddit.com were blocked in this research pass, and web-search coverage of Reddit threads on this specific topic (food-app signup friction) turned out to be very thin — repeated targeted queries returned SEO blogs *claiming* to summarize Reddit sentiment rather than real threads. One such blog (a meal-planning content site) was directly checked and confirmed to contain fabricated "Reddit consensus" with no real links or quotes. That pattern is called out explicitly wherever it recurs, rather than treated as evidence.

**What was actually verified:**
- Exactly one real, sourced Reddit thread was found relevant to signup friction generally (not food-specific): r/androiddev discussing early-screen drop-off, including a developer's own comment that people abandon apps "just because of the first screens." Single source, general-app, not food-specific.
- Noom's onboarding backlash and FTC settlement is well-documented via press (not Reddit) and is the strongest real evidence of "long onboarding as a trust/legal risk."
- Samsung Food/Whisk user complaints (broken cross-device sharing after rebrand, app ignoring set preferences, capped free tier) are documented via app-store reviews and Samsung's own community forum — real user sentiment, but not confirmed as Reddit-sourced specifically, despite that attribution appearing in secondary summaries.
- Casual use of ChatGPT for "what's in my fridge, give me a recipe"-style prompting is reported by press (Tom's Guide, TechRadar) referencing Reddit users doing this, but no specific thread was verifiably linked — **plausible, not confirmed to primary source.**

**What was not found, despite explicit search:** direct Reddit discussion of "why do I need to sign up" for food apps specifically, Mealime/AnyList/Paprika signup complaints, "too many questions" fatigue for meal apps, or diet-app privacy-fear threads. Absence of search results is not proof these sentiments don't exist on Reddit — it means this research pass could not surface them, and the recommendation below does not lean on them as if they were confirmed.

**Synthesis:** The strongest available signal — Noom's documented backlash, Samsung Food's broken-promise complaints, and the one verified early-screen-abandonment comment — all point the same direction as the competitor research in §3: forced friction before value breeds resentment, and account value has to be a kept promise (working sync, working preferences) rather than a request made on faith. This is treated as a reasonable inference from adjacent, real evidence, not as an established Reddit consensus.

---

## 5. Competitor Login Comparison Table

See §3.1 above — consolidated there to avoid duplication.

## 6. Competitor Preference-Onboarding Comparison

| Pattern | Apps | Preference collection timing |
|---|---|---|
| Full quiz at signup, plan shown as reward | Eat This Much, MyFitnessPal | All at once, before first real value |
| Preferences after login, before first use | Samsung Food | All at once, immediately post-signup |
| No preference/taste system at all | AnyList, Paprika | N/A |
| Progressive, tied to plan-building | Plan to Eat (inferred) | Gradual, as plans are built |
| No preferences — general-purpose assistant | ChatGPT, Gemini, Perplexity | User states preferences ad hoc in natural language, per conversation |

---

## 7. User Psychology Analysis

FoodPadi's three modes carry genuinely different urgency/patience profiles, and the evidence above supports treating them differently rather than applying one onboarding to all three:

- **Eat Now** — high urgency, low patience. A user opening this mode is hungry now. Competitor evidence: this is exactly the shape of query ChatGPT/Perplexity users run with zero account and get an immediate answer. Any signup or preference wall here directly contradicts the demonstrated behaviour of the closest analogous product category (general AI assistants) and this mode's own urgency.
- **Cook Today** — moderate patience. The user is at home, not mid-decision-paralysis in a shop aisle, but still wants a fast answer, not a quiz. Same logic as Eat Now, slightly more tolerance for one or two clarifying questions ("what have you got?") because those questions are themselves the mechanism of getting a *better* answer, not a gate in front of it.
- **Plan Ahead** — the user is deliberately investing time. This is the one mode where competitor evidence (Eat This Much, MyFitnessPal, Samsung Food) shows users tolerate — and even expect — a short, purposeful preference/goal step, because the output (a plan) is valuable specifically because it's personalized and saved.

**Conclusion: the onboarding strategy should differ by intent.** A single one-size-fits-all onboarding (what FoodPadi currently has) is the wrong shape for at least two of its three core modes.

---

## 8. Login vs Preferences Analysis

The three options in the brief are not actually mutually exclusive across FoodPadi's whole product — they're each correct for a different part of it:

- **Option A (login first)** is roughly correct for **Plan Ahead** only, matching Samsung Food/Eat This Much/MyFitnessPal.
- **Option B (preferences during account creation)** is a trap if applied wholesale: Noom shows what happens when this becomes long and manipulative-feeling. Where it applies (Plan Ahead), it must be short (a handful of questions, not a battery) and every question must visibly earn its place in the resulting plan.
- **Option C (progressive/hybrid)** is correct for **Eat Now and Cook Today**, matching Paprika/ChatGPT/Gemini/Perplexity, and is also the correct model for preference depth generally — start minimal, build up through use.

**FoodPadi's answer is not "pick one" — it's C as the overall philosophy, with A/B's logic applied narrowly and briefly inside Plan Ahead only, at the moment persistence is actually needed.**

## 9. Guest Mode Analysis

Guest mode is well-precedented for exactly the kind of one-off-answer interaction Eat Now and Cook Today represent (Paprika for local recipe use; ChatGPT/Gemini/Perplexity for casual Q&A). It is not precedented, and does not make sense, for Plan Ahead, saved memory, shopping lists, reminders, or anything premium — those features are definitionally about persistence.

Recommendation: **guest mode is scoped to Eat Now and Cook Today only**, session-based (no data persisted beyond the session, no `ai_memory` writes, no pantry writes), with the account-creation prompt appearing the moment the guest tries to do something that requires persistence (save, plan, remind, add to list).

## 10. Authentication Options

| Method | Verdict for FoodPadi MVP | Why |
|---|---|---|
| Email/password | **Keep (already built)** | Baseline, works everywhere, already implemented with bcrypt + JWT. |
| Apple Sign-In | **Add, P1, paired with Google** | On iOS, Apple's guidelines require offering Sign in with Apple (or an equivalent privacy-preserving option) if a third-party social login is offered (VERIFIED, current as of the Jan 2024 guideline update). Ship together with Google, not alone. |
| Google Sign-In | **Add, P1, paired with Apple** | Standard, low-friction; must be paired with Apple on iOS per above. |
| Magic link | **Not as a sole method** | Documented deliverability failure modes (spam filtering, cross-device link-opening, expiry) mean it needs a fallback method if offered at all (VERIFIED). Not recommended for MVP. |
| Passkeys | **Evaluate P2/P3** | Strong, credible, UK-inclusive 2026 data: 90% awareness, 75% have enabled one somewhere, 49% regular use when offered (VERIFIED, FIDO Alliance 2026 report). Real phishing-resistance benefit. Not yet universal enough to be the *only* method, but a credible addition once the core auth flows are stable. |
| Guest/anonymous session | **Add, P0/P1** | Required to support the Eat Now/Cook Today guest-mode recommendation above. Not a login *method* for a persistent account — a lightweight, ephemeral, rate-limited session token. See [FOODPADI_AUTHENTICATION_SPEC.md](FOODPADI_AUTHENTICATION_SPEC.md). |

## 11. Security & Privacy Analysis

This is the single most consequential, best-evidenced finding in this research pass:

- **UK GDPR data minimisation (Article 5(1)(c), ICO guidance, VERIFIED):** personal data must be "adequate, relevant and limited to what is necessary" for the stated purpose. Organisations must not collect data "on the off-chance it might be useful in future."
- **Special category (health) data (Article 9, ICO guidance, VERIFIED):** health data is explicitly listed as special category, requiring both a lawful basis *and* a separate Article 9 condition (explicit consent, practically, for most consumer products).
- **The critical, directly-relevant distinction (VERIFIED via independent legal commentary on nutrition apps):** allergy data and any diet tied to a health condition **is** treated as health data (special category); general taste/cuisine/ingredient preferences, on their own, are **not** automatically special category data.

This directly validates a decision FoodPadi already made before this research pass (Decision 10-12 in the product spec, already implemented as "foods I choose to avoid" rather than "my allergies/medical conditions" in [PRIVACY_DATA_MODEL.md](PRIVACY_DATA_MODEL.md) and the current `avoided_ingredients` schema). The research adds a citable legal reason, not just a product-philosophy one, to keep it that way — and extends it: **whatever onboarding step collects preferences must never ask "why," must never use medical/allergy framing, and should stay in the general-preference bucket by construction**, because the moment it starts resembling a health-data collection flow, the special-category-data obligations (explicit consent, extra safeguards) attach.

**Whether preferences are collected before or after account creation does not change this legal analysis** — data minimisation and special-category-data rules apply regardless of timing. What timing *does* change is exposure and trust: collecting a large preference block at signup, before the user has any reason to trust the app, creates pressure to over-disclose (people tend to fill in optional-looking fields when presented as part of "setup"); collecting the same information progressively, tied to an action the user just took, is minimal by construction and easier for the user to decline any single item of without feeling like they're "failing" onboarding.

**Flag for legal review (not resolved here):** whether FoodPadi's specific field set (cuisine, liked/disliked ingredients, cooking style, budget) could ever edge toward special-category inference (e.g., a pattern of avoided ingredients that strongly implies a diagnosed condition) is a product-design question, not just a data-collection-moment question, and should be reviewed by legal/DPO before scaling preference collection significantly beyond what's built today.

## 12. Conversion Funnel Analysis

Modelled funnel (Landing → CTA → [Guest use] → Signup trigger → Preference completion → First food decision → First saved artifact → Return visit → Retention → Premium conversion):

| Stage | Login-first (current build) | Preferences-first (Option B wholesale) | Progressive/hybrid (recommended) |
|---|---|---|---|
| Signup conversion | Lower — full wall before any value | Lowest — wall + quiz before any value | Higher for Eat Now/Cook Today (no wall); comparable-to-competitor for Plan Ahead |
| Onboarding completion | Users who bounce never see this stage | Highest drop-off if quiz is long (Noom risk) | Short, contextual steps → higher completion per step |
| Time-to-value | Slow (account + disclaimer + goal before Home) | Slowest | Fast for Eat Now/Cook Today (seconds); appropriately slower for Plan Ahead (matches user's own intent) |
| Personalisation | Low initially (only 1 mandatory goal today) | High immediately, but only if quiz is trusted/short | Builds over time, more accurate because it's behaviour-linked |
| First-session engagement | Depressed by the wall | Depressed further by the quiz | Highest — value first |
| Retention | Unverified numerically, but general UX literature ties early friction to higher abandonment | Noom-style risk of resentment-driven churn if perceived as manipulative | Best-supported direction per both competitor and privacy-benchmark research |
| Privacy exposure | Same data, worse timing (asked before trust established) | Same data, worst timing + most volume at once | Best — minimal, contextual, easiest to decline per-item |
| Implementation complexity | Lowest (already built) | Medium | **Highest** — requires a guest-session concept, entitlement checks that handle "no user," and a persistence-triggered signup prompt |
| Premium conversion | Unaffected directly by this decision | Unaffected directly | Unaffected directly — premium gating is a separate, later concern (§20 IMPLEMENTATION_PLAN Phase 7) |

**Weighting note:** implementation complexity is the recommended model's only real cost, and it is a one-time engineering cost, not a recurring one. Every other row favours the progressive/hybrid model, several of them (privacy exposure, retention risk, trust) by evidence that is directly on point rather than merely directional. That is why complexity does not outweigh the recommendation.

## 13. Time-to-Value Analysis

- **Eat Now (recommended):** app open → question/context → result, zero account. Matches ChatGPT/Perplexity's near-zero time-to-value for casual queries.
- **Cook Today (recommended):** app open → "what have you got?" → 2-3 recipe options, zero account. One extra step versus Eat Now, but that step *is* the value mechanism, not a gate in front of it.
- **Plan Ahead (recommended):** account → 1-2 quick preference/goal questions → first plan. Slower by design, matching the user's own higher time-investment intent and the competitor pattern (Eat This Much, MyFitnessPal) that a short quiz-to-plan sequence is accepted when the plan is the reward.

---

## 14-16. Recommended Strategy (Onboarding, Login, Preferences)

Fully specified in [FOODPADI_ONBOARDING_SPEC.md](FOODPADI_ONBOARDING_SPEC.md) and [FOODPADI_AUTHENTICATION_SPEC.md](FOODPADI_AUTHENTICATION_SPEC.md) at file/screen/endpoint level. Summary:

- **Onboarding:** intent-based, not one-size-fits-all (§7-9).
- **Login:** email/password (kept) + Apple/Google Sign-In paired (P1) + guest session (P0/P1) + passkeys (P2/P3 candidate).
- **Preferences:** progressive by default; the only upfront-and-optional step is a single, skippable goal question at the point an account is created (already built as `GoalScreen`, needs a skip path added — see spec).

## 17. Required vs Optional User Data

| Field | Classification | Why |
|---|---|---|
| Email + password (or social identity) | **Required** at account creation | Cannot have an account without it. |
| Food/lifestyle goal | **Optional/skippable** at account creation | Currently forced in the build; should become skippable — a forced choice among "goals" (even with a "no particular goal" escape hatch) is still a mandatory tap that the evidence doesn't support requiring. |
| Household size, favourite cuisines | **Optional**, offered but skippable, at account creation or shortly after | Low-cost, genuinely useful for Plan Ahead, but not blocking. |
| Foods avoided, disliked ingredients, cooking time/skill, budget | **Progressive** — collected contextually during Eat Now/Cook Today/Plan Ahead use, or via explicit "remember this" actions | Matches the minimal-by-construction privacy argument in §11; these are exactly the fields best captured at the moment they're relevant, not in advance. |
| Medical conditions, allergy diagnoses, body weight/height, any body-shape framing | **Never collected** | Special-category data under UK GDPR (§11); also excluded by existing product decisions (Decision 10-13). |

## 18-21. Intent-Based Onboarding, First-Time Journey, Returning Journey, Progressive Personalisation

Fully specified in [FOODPADI_ONBOARDING_SPEC.md](FOODPADI_ONBOARDING_SPEC.md) (journeys) and [FOODPADI_PERSONALISATION_SPEC.md](FOODPADI_PERSONALISATION_SPEC.md) (personalisation mechanics, review/edit/forget controls).

## 22-23. A/B Testing Plan, Analytics Events

Fully specified in [FOODPADI_ONBOARDING_ANALYTICS.md](FOODPADI_ONBOARDING_ANALYTICS.md).

## 24-27. Technical Implementation, Database Changes, Authentication Architecture, Security Requirements

Fully specified in [FOODPADI_AUTHENTICATION_SPEC.md](FOODPADI_AUTHENTICATION_SPEC.md).

## 28. UX Wireframe Description

Fully specified in [FOODPADI_ONBOARDING_SPEC.md](FOODPADI_ONBOARDING_SPEC.md) §"Wireframe descriptions."

## 29-30. Product Backlog, Implementation Phases

Fully specified in [FOODPADI_ONBOARDING_SPEC.md](FOODPADI_ONBOARDING_SPEC.md) §"Backlog & Phasing," prioritised P0-P3.

## 31. Risks

| Risk | Severity | Mitigation |
|---|---|---|
| Guest-mode Eat Now/Cook Today calls cost real LLM inference money with no account to gate by identity | **High** | Rate-limit guest sessions by device/session token (stricter than authenticated limits); track "AI cost per guest session" as its own metric from day one (extends the existing "AI cost per active user" metric in [ANALYTICS_PLAN.md](ANALYTICS_PLAN.md)). |
| Two-tier (guest vs. account) state adds real complexity to the Layer 3 rules/entitlement engine | Medium | Design the guest session as a first-class, lightweight concept in the API from the start (§ auth spec), not retrofitted after Phase 2-4 features exist. |
| Guest sessions could be abused to bypass the safety-boundary/disclaimer acknowledgement | **High** | The disclaimer/safety boundary (§11/§27 of the product spec) must be shown and logged even in guest mode before any food/ingredient information is displayed — this is non-negotiable and independent of account state. |
| Removing the forced goal-selection step could reduce the volume of `food_goals` data available for future personalization/analytics | Low | Acceptable trade — the evidence in §11/§12 doesn't support forcing it, and it can still be prompted contextually later (§ personalisation spec). |
| Eat Now/Cook Today don't exist as real features yet (Phase 2-4 unbuilt) | **Blocking for full rollout, not for the decision itself** | The onboarding *strategy* can and should be decided and partially implemented now (auth architecture, guest session, disclaimer-in-guest-mode); the full "guest experiences real Eat Now value" flow is genuinely blocked on Phase 2/4 feature work landing — sequencing made explicit in the backlog. |

---

# FOODPADI LOGIN & ONBOARDING DECISION

RECOMMENDATION:
Progressive/hybrid onboarding (Option C), applied per-intent: guest-accessible Eat Now and Cook Today; account-first (short, purposeful) Plan Ahead. Not a single onboarding model for the whole app.

ACCOUNT CREATION:
Triggered by the first action that requires persistence — saving a meal/recipe, starting a Plan Ahead session, turning on a reminder, adding to a shopping list, or opening Plan Ahead at all (since a plan is inherently a saved artifact).

PREFERENCES:
Progressive by default. At account creation, at most one optional/skippable goal question (already built, needs a skip path added). Everything else (avoided foods, cooking time, budget, favourite cuisines) is captured contextually during actual use, tied to a specific action, never as an upfront block.

GUEST MODE:
Yes, for Eat Now and Cook Today only. No guest access to Plan Ahead, saved memory, shopping lists, reminders, or premium — those are definitionally persistent features.

AUTHENTICATION:
Email/password (already built) + Apple Sign-In and Google Sign-In shipped together (Apple's guidelines require Apple Sign-In if a third-party social login is offered) + a lightweight, rate-limited guest session token. Passkeys are a credible P2/P3 addition given strong 2026 UK-inclusive adoption data, not required for MVP. Magic link is not recommended as a primary method (documented deliverability failure modes).

REQUIRED AT SIGNUP:
Email + password (or social identity token). Nothing else.

OPTIONAL:
Food/lifestyle goal (single choice, skippable), household size, favourite cuisines.

PROGRESSIVE:
Foods avoided, disliked ingredients, cooking time/skill, budget, favourite meals — all captured contextually during Eat Now/Cook Today/Plan Ahead use or via explicit "remember this" actions.

DO NOT COLLECT:
Medical conditions, allergy diagnoses, body weight/height/BMI, any body-shape or weight-loss framing.

FIRST VALUE:
Eat Now/Cook Today: a real recommendation or recipe, before any signup. Plan Ahead: a first draft plan, immediately after one short (1-2 question) preference step post-signup.

SIGNUP TRIGGER:
The exact moment the user does something that requires persistence — not app open, not "after N free uses" as a default (that pattern can be tested later as a growth lever, but is not the primary trigger).

PRIMARY REASON:
Every competitor and industry-benchmark data point that could be verified points the same direction: gating value behind an account or a long questionnaire before demonstrating anything measurably increases abandonment and resentment (Noom's FTC settlement is the clearest cautionary case), while account value earned by a concrete, already-demonstrated benefit (saving a plan, syncing a list) converts and retains better.

SECONDARY REASON:
UK GDPR data minimisation and the special-category-data status of allergy/medical data (both independently verified via ICO guidance and nutrition-app legal commentary) mean progressive, contextual preference collection is not just better UX — it is the more defensible data-protection posture, and it's consistent with decisions FoodPadi had already made about avoiding medical framing before this research began.

BIGGEST RISK:
Guest-mode AI interactions (Eat Now/Cook Today) create an unmetered LLM-cost surface with no account to rate-limit by identity.

MITIGATION:
Session-token-based rate limiting for guest AI calls, stricter than authenticated limits, with "AI cost per guest session" tracked as a first-class metric from the first guest-mode release — not added after the fact.
