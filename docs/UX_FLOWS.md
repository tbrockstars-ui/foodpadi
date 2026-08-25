# UX Flows

Detailed screen-level flows. See [USER_JOURNEYS.md](USER_JOURNEYS.md) for the narrative version and [ACCESSIBILITY notes below](#accessibility) for WCAG requirements per §35.

## Home Screen Layout (§4, §34)

```
[ Headline: "What do you need today?" ]

[ EAT NOW ]      [ COOK TODAY ]
[ PLAN AHEAD ]   [ SCAN ]

--- Your companion ---
<single proactive card, e.g.:>
"You planned chicken rice for 6:30 PM.
 You already have everything you need.
 Still happy with that?"
[Cook it] [Change it] [Eat out]
```

Design rules: 4 primary actions max above the fold, large touch targets (min 44x44pt), single companion card (never a feed of multiple nudges), no secondary menu competing for attention.

## Eat Now Flow

```
Tap Eat Now
  → conversational input (text or voice) + optional quick chips (Budget / Nearby / Quick / Cuisine)
  → [location permission prompt if not yet granted — skippable, degrades to manual area entry]
  → ranked results (2-4 cards: name, price, distance/time, source type)
  → filter chips refine in place (no re-prompt)
  → select → confirmation + "log this choice" (silent, automatic) → optional quick feedback
```

## Cook Today Flow

```
Tap Cook Today
  → ingredient input (chips from pantry/preferences + free add) + constraints (time/servings/budget, all optional)
  → 2-3 recipe option cards (time, difficulty, hero ingredients)
  → select → Cook Mode:
        [Step N of M] [Timer if applicable] [Next] [Back] [Pause]
        substitution icon available per step where relevant
  → completion → quick feedback (liked/disliked) → optional "save as favourite"
```

## Plan Ahead Flow

```
Tap Plan Ahead
  → scope choice: Today | 3-Day | Week | Custom
  → proposed plan (list of meal cards by day/slot)
  → per-meal actions: Swap | Regenerate | Remove | Move | Adjust servings
     (each action affects only that meal card, plan re-renders incrementally)
  → Accept Plan → prompt: "Generate shopping list now?" [Yes] [Later]
```

## Plan Rescue Flow (§8)

```
Trigger: user says "I can't cook tonight" (companion card or chat)
  → "Let's rescue tonight."
     [Quick cook] [Use leftovers] [Eat Now nearby] [Move to tomorrow] [Choose something else]
  → selection routes into the relevant existing flow (Cook Today/Eat Now/plan edit)
  → tonight's plan item updates status to `rescued` — no negative framing shown anywhere
```

## Scan Flow (§14, Phase 6)

```
Tap Scan → choose Barcode | Receipt | Fridge/Pantry photo
  → capture
  → AI detection result shown as an editable list: "You have: Chicken, Rice, Peppers... Anything incorrect?"
  → [Edit] any item before confirming
  → Confirm → pantry updated → "Here are meals you can make now" (routes into Cook Today)
```

Rule: nothing from Scan writes to `pantry_items` as confirmed without this explicit user confirmation step (§14, [RISK_REGISTER.md](RISK_REGISTER.md) R7).

## Accessibility

- All interactive controls keyboard/switch-navigable and screen-reader labelled.
- Colour contrast meets WCAG 2.2 AA; no colour-only status indicators (e.g. budget state also uses text/icon, not just red/green).
- Respect OS-level reduced-motion setting for Cook Mode timers/transitions.
- Error messages are specific and associated with their field (not a generic banner).
