# Feature Roadmap

Phasing mirrors spec §33 and §47. See [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) for execution detail and [MVP_SCOPE.md](MVP_SCOPE.md) for the launch line.

## MVP (V1)

Auth · Profile · Preferences · Goals · Eat Now · Cook Today · Plan Ahead (incl. meal swap/regenerate) · Shopping List · Basic Reminders · AI Companion Chat · Food Info Display · Disclaimer · Privacy Controls · Feedback · Subscription Foundation · Analytics · Admin/Error Monitoring · Plan Rescue (core differentiator, included in V1 despite appearing later in the phase list — it is load-bearing for retention).

## V2

- Receipt scanning
- Pantry intelligence (confirmed-scan based, not silent inference)
- Fridge scanning
- Supermarket integrations (start with one, not all)
- Grocery price comparison
- Family/household planning
- Food waste intelligence (expiry-aware suggestions)
- Richer Eat Now discovery (more sources, more filters)

## V3

- Autonomous shopping **basket preparation** (never autonomous purchase)
- Real-time grocery substitution
- Household food intelligence
- Predictive food planning
- Advanced Personal Food Graph (cross-signal ranking)
- Voice-first companion
- Wearable/context integration — only if a concrete, justified use case emerges; not built speculatively

## V4 — "Autonomous Food Companion"

With explicit per-action user permission only:

```
Plan → check pantry → find products → compare prices → prepare basket
     → request approval → adapt to availability → remind → learn
```

**Hard rule carried from spec §47: never purchase automatically without explicit user authorisation for that specific purchase.** This is a permanent constraint, not a v1-of-the-feature limitation to be relaxed later.

## Explicitly Never (unless product direction changes with full legal sign-off)

- Allergy monitoring / diagnosis / medical treatment (Decisions 10-11)
- Body-shape-based features (Decision 13)
