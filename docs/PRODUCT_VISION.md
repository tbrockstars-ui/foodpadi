# Product Vision

## Positioning

**FoodPadi — your food companion.**

"Your food companion that plans with you, not for you."

"Don't plan your life around your meal plan. Let your meal plan adapt to your life."

## Core Principle

**The plan serves the person. The person does not serve the plan.**

Real life changes — tiredness, unexpected costs, a missing ingredient, a sudden craving, being out instead of home. FoodPadi's job is to absorb that change without making the user feel they failed. This principle overrides every other design decision in this product; when a feature and this principle conflict, the principle wins.

## The Three Modes

| Mode | User state | Core question |
|---|---|---|
| **Eat Now** | Hungry, deciding in the moment (often out and about) | "What can I eat right now?" |
| **Cook Today** | At home, wants to cook | "What can I cook today?" |
| **Plan Ahead** | Wants to get ahead of decisions | "Help me plan my meals." |

Supporting capabilities — Scan, Shop, Remind, Adapt, Learn — exist to make those three modes effortless over time, not as standalone features to be marketed individually.

## What FoodPadi Is Not

- Not a recipe database (§13 Principle 6) — competitors already win on volume; we don't compete there.
- Not a nutrition-therapy or allergy-monitoring app (§11, Decisions 10-12) — hard boundary, not a soft feature gap.
- Not a body-image or weight-loss product (§10, Decision 13) — goals are framed as food/lifestyle, never body shape.
- Not a generic chatbot wrapper — the value is persistent, structured food context (see [AI_ARCHITECTURE.md](AI_ARCHITECTURE.md)), not conversational novelty.

## The Moat

Not the LLM — the LLM is replaceable (§22). The moat is the **Personal Food Graph**: preferences → meals → ingredients → pantry → purchases → plans → behaviour → budget → context → feedback, accumulated per user over time. A competitor can copy the UI in a weekend; they cannot copy a user's six months of accumulated food history sitting in our database.

## North Star

**Successful food decisions per active user** (Eat Now selection made, meal accepted, meal completed, plan accepted, shopping list completed) — not recipes generated. See [ANALYTICS_PLAN.md](ANALYTICS_PLAN.md).

## Market

UK-first (§29). GBP, UK supermarkets/restaurants, UK privacy law (UK GDPR), UK date/time conventions. International expansion is an explicit non-goal for V1 but the architecture avoids UK-only hard-coding beyond data sourcing (see [TECHNICAL_ARCHITECTURE.md](TECHNICAL_ARCHITECTURE.md)).
