# Analytics Plan

## North Star Metric (§31)

**Successful food decisions per active user** — counted as any of: Eat Now selection made, meal accepted, meal started, meal completed, plan accepted, shopping list completed.

Explicitly **not** tracked as a success metric: "number of recipes generated" (§31) — this measures LLM output volume, not user value, and would incentivise the wrong behaviour.

## Supporting Metrics

- DAU / WAU / MAU
- 7-day and 30-day retention
- Premium conversion rate
- Plan acceptance rate and plan completion rate
- Eat Now conversion rate (request → selection)
- Shopping list completion rate
- Meal completion rate (Cook Mode started → finished)
- Reminder engagement (opened/acted-on vs. dismissed vs. disabled-category)
- User feedback volume/sentiment
- Churn
- **AI cost per active user** — tracked from day one given LLM inference cost is a real unit-economics risk

## Event Model

Analytics events are derived from the same domain events already written for product logic (`food_events`, `meal_plan_items.status` transitions, `reminders.delivered_at`/`dismissed_at`), not a separate parallel tracking SDK sprinkled through the UI — this avoids drift between "what actually happened" and "what analytics says happened."

## Admin/Internal Analytics (§38)

Internal dashboard tracks: active users, retention, per-mode usage (Eat Now/Cook Today/Plan Ahead/Shopping/Reminders), plan changes, meal completion, premium conversion/cancellation, AI usage and cost, error rates, safety events (see [AI_SAFETY_POLICY.md](AI_SAFETY_POLICY.md)), and feedback — as aggregates by default. Per-user drill-down is a permissioned, audit-logged admin action, not a default view, per §38's "do not expose sensitive user information unnecessarily."

## Privacy Constraint on Analytics

Free-text fields flagged as potentially special-category data (see [PRIVACY_DATA_MODEL.md](PRIVACY_DATA_MODEL.md)) are excluded from analytics pipelines and BI exports by default.
