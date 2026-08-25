# User Journeys

## Journey 1 — First-time onboarding

1. Sign up (email or Apple/Google).
2. Disclaimer shown (§12) — must acknowledge to proceed.
3. "What is your food & lifestyle goal?" — single-select from non-medical goal list (§10).
4. Optional: a few quick preference chips (cuisines liked, foods avoided — framed as "choose to avoid," never "medical conditions").
5. Optional: household size, typical budget.
6. Land on Home: "What do you need today?"

No mandatory ingredient logging, no mandatory weekly-plan commitment — matches §13 Principles 1 & 2.

## Journey 2 — Eat Now (Ade)

1. Taps **Eat Now**.
2. Types or speaks: "I'm hungry, £8, near me."
3. App requests location permission (optional; degrades to "add your area" text entry if declined).
4. Ranked list returned: 2–4 options with price + distance, sourced from Layer 1 data.
5. Filters available (price, distance, cuisine) without re-asking the whole question.
6. Selects one → `food_events` logs `eat_now_selected` → companion follow-up next time: "Enjoyed the wrap yesterday? Want something similar?"

## Journey 3 — Cook Today (Priya)

1. Taps **Cook Today**.
2. Enters ingredients on hand (chips, not free typing every time — reuses pantry/preferences where known).
3. States a constraint: "20 minutes."
4. 2–3 realistic recipe options returned (not a wall of results).
5. Selects one → enters **Cook Mode** (step-by-step, timers, pause/resume).
6. On completion, quick feedback: liked / disliked → feeds Personal Food Memory.

## Journey 4 — Plan Ahead (Sam)

1. Taps **Plan Ahead** → chooses Today / 3-day / Week / Custom (not forced to weekly).
2. Plan proposed against budget + household size + goal.
3. Sam swaps one meal — only that meal regenerates, not the whole plan (§7).
4. Accepts plan → **Shopping List** auto-generated, pantry-confirmed items subtracted.
5. Reminder scheduled: "You're near a supermarket. You have 4 items missing for tomorrow's meals." (§18)

## Journey 5 — Plan Rescue (signature feature, §8)

1. Sam: "I can't cook tonight."
2. Companion: "Let's rescue tonight." → options: Quick cook / Use leftovers / Eat Now nearby / Move to tomorrow / Choose something else.
3. Sam picks "Eat Now nearby" → flows into Journey 2 without losing the rest of the week's plan.
4. Plan updates: tonight marked `rescued`, no guilt copy, no "you failed" messaging (§19).

## Journey 6 — Memory correction

1. User: "Remember this as one of my favourite meals" after a Cook Today session.
2. Confirmed fact written to `ai_memory` (source: explicit).
3. Later, user: "Forget that I like this" → hard delete from `ai_memory`, confirmed in UI.
4. Settings → Food Profile lets the user view/export/delete the whole profile at will (§9).

## Journey 7 — Premium upgrade

1. User hits a soft limit (e.g. wants Plan Rescue or pantry management beyond free tier).
2. Paywall explains **persistent food management** value (reduced waste, budget control, adaptive planning) — not "unlimited AI" (§21).
3. Trial or direct purchase via RevenueCat → entitlement flips server-side → gated features unlock immediately.
4. Cancellation flow is equally easy to find — no dark patterns; matches §8 acceptance criteria (§40 items 18-19).
