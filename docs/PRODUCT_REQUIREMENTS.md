# Product Requirements

This document translates the product spec into testable requirements, organised by the three primary modes plus supporting systems. Each requirement traces back to a spec section for auditability.

## Home Screen (§4)
- REQ-1: Home screen headline is "What do you need today?" with four primary actions: Eat Now, Cook Today, Plan Ahead, Scan.
- REQ-2: A single "Your companion" card surfaces the single most relevant proactive suggestion (e.g. today's planned meal confirmation) — never a list of multiple competing prompts.
- REQ-3: No secondary navigation/dashboard clutter is shown above the fold.

## Eat Now (§5)
- REQ-4: Accepts free-text/voice natural-language input (hunger, budget, location, cuisine, time, mood).
- REQ-5: Returns a ranked, small set of options (not an open-ended search results page), each showing price and distance where available.
- REQ-6: Supports filtering by price, distance, cuisine, meal type, preference, time, source type (restaurant/store/takeaway/ready-to-eat) without re-entering the whole request.
- REQ-7: Never states or implies medical/allergy safety (hard-linked to [AI_SAFETY_POLICY.md](AI_SAFETY_POLICY.md)).

## Cook Today (§6)
- REQ-8: Accepts ingredients, time, servings, skill, equipment, budget, cuisine as optional structured or NL input.
- REQ-9: Returns a small number (2–3) of realistic recipe options, not an exhaustive list.
- REQ-10: A stated time constraint (e.g. "20 minutes") **adapts** the existing option set rather than discarding it and starting over.
- REQ-11: Cook Mode provides step-by-step instructions, current/next step, timers, servings adjustment, substitutions, pause/resume.

## Plan Ahead (§7)
- REQ-12: Planning scope is a user choice: Today / Next 3 Days / This Week / Custom — never defaulted to a forced weekly plan.
- REQ-13: Users can accept, reject, replace one meal, regenerate one meal, move, swap, add, remove a meal, and change servings/budget/cooking time per meal without regenerating the entire plan.

## Plan Rescue (§8)
- REQ-14: A single, discoverable entry point (e.g. "I can't cook tonight") surfaces exactly the five options in spec §8: Quick cook, Use leftovers, Eat Now nearby, Move to tomorrow, Choose something else.

## Personal Food Memory (§9, §36)
- REQ-15: Profile fields are all optional beyond auth + goal selection; nothing is a gate to using core features.
- REQ-16: Users can view, edit, export, and delete their food profile and AI memory in full, including individual-fact deletion ("forget that I like this").

## Food & Lifestyle Goals (§10)
- REQ-17: Goal options are the non-medical set in §10 only; no body-shape/weight-loss framing anywhere in copy or data model.

## Allergy/Medical Boundary (§11, §27)
- REQ-18: See [AI_SAFETY_POLICY.md](AI_SAFETY_POLICY.md) — non-negotiable, tested at release gate.

## Budget (§16)
- REQ-19: Weekly food budget is user-defined; system tracks planned/actual spend and remaining balance as a deterministic calculation (never LLM-estimated).
- REQ-20: A choice that would exceed budget surfaces non-shaming options (Keep it / Find cheaper option / Adjust another meal) — never blocks the user outright.

## Shopping List (§17)
- REQ-21: Generated only from an *accepted* plan; consolidates duplicates, subtracts confirmed pantry inventory, organised by category, editable, shareable, checkable.

## Reminders (§18, §37)
- REQ-22: Every reminder type maps to a concrete trigger condition; user controls category, frequency, quiet hours, and can opt out per category.

## Free vs Premium (§20-21)
- REQ-23: Free tier is fully usable for basic Eat Now/Cook/Plan/Shopping without payment.
- REQ-24: Pricing and plan definitions are server-configured, never hard-coded in client or backend constants.

## Non-Functional
- REQ-25: Mobile-first, one-handed usable UI (§34).
- REQ-26: WCAG 2.2 AA target where practical (§35).
- REQ-27: UK-only data/currency/date formatting in V1 (§29), architecture i18n-ready for later (§29 caveat).
