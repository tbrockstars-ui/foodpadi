# Competitive Strategy

## Landscape

Meal planners (Mealime, Samsung Food, Plan to Eat, Paprika, AnyList, Good Food), supermarket/restaurant discovery apps, and general LLM assistants (ChatGPT, Gemini, Perplexity).

## Strategy: Don't Compete Feature-for-Feature

A generic LLM can already produce a recipe on request — that is not a moat, and trying to out-recipe ChatGPT is a losing game. Every proposed feature should pass this test (§41):

> If ChatGPT could already do this trivially, what persistent workflow or data makes our implementation better?

## Where FoodPadi Wins

| Competitor category | Their strength | Our differentiation |
|---|---|---|
| Recipe/meal-plan apps (Mealime, Paprika, AnyList) | Large recipe libraries, rigid weekly plans | Flexible, adaptive plans (§7); Plan Rescue when life changes; budget as a first-class constraint, not an afterthought |
| Supermarket/restaurant apps | Deep catalogue for one retailer/venue | Cross-context Eat Now that reasons across budget + preference + distance in one request |
| General LLM assistants (ChatGPT, Gemini, Perplexity) | Infinite recipe generation, no memory of your kitchen | Persistent Personal Food Memory + pantry state + budget tracking that carries across sessions — the LLM has no idea what's in your fridge; we do |

## The Combination Moat

No single competitor combines: **Personal Memory + Adaptive Planning + Eat Now + Cook Today + Plan Ahead + Reminders + Budget + Food Waste + Shopping Workflow** in one persistent, cross-context companion. Recipe apps don't do Eat Now. Discovery apps don't remember your pantry. LLMs don't remember anything at all between sessions unless we build the memory layer ourselves (§22, [AI_ARCHITECTURE.md](AI_ARCHITECTURE.md)).

## What We Deliberately Don't Build

- A large proprietary recipe content library (§13 Principle 6) — we generate/adapt against structured ingredient data instead of maintaining an editorial content team.
- Full integration with every UK supermarket at launch — one credible source beats broad-but-shallow coverage (see [RISK_REGISTER.md](RISK_REGISTER.md) R10).
- A social network layer — not part of the core value proposition and expands the privacy/moderation surface for no differentiation gain.
