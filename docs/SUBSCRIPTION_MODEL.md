# Subscription Model

## Tiers (structure, not final prices — §20 explicitly forbids hard-coding prices pre-validation)

| Tier | Indicative price (config, not fixed) | Includes |
|---|---|---|
| Free | £0 | Basic Eat Now, basic recipes, limited planning, basic shopping list, limited AI interaction, basic preferences |
| Premium | ~£5.99–£7.99/month (server-configured) | Persistent Personal Food Memory, unlimited planning, intelligent reminders, Plan Rescue, pantry management, receipt/fridge scanning, advanced budget optimisation, food waste intelligence, advanced Eat Now, household planning, personal insights, shopping integrations |
| Family | ~£9.99/month (server-configured) | Premium features shared across a household |

## Architecture

- **RevenueCat** fronts App Store/Play Store billing; our backend's `subscriptions` table is the source of truth for entitlement, updated only via verified RevenueCat webhook events.
- Product/price definitions live in RevenueCat's remote config + our backend's plan-definition config — never as literals in app or backend code — so pricing/trial-length can change without an app release (§20).
- Feature gating is a single server-side entitlement check reused across every gated endpoint, not duplicated per-feature logic.

## Why Pay? (§21 — sell the workflow, not the AI)

Marketing and in-app copy sell **persistent food management**, not "unlimited AI recipes":
- Reduced decision fatigue
- Reduced food waste
- Better use of what's already owned
- Easier shopping
- Budget control
- Timely, non-spammy reminders
- Adaptive planning that survives real life
- Household coordination

Insight-style value statements ("You saved approximately £14 this month by using food already in your kitchen") are only shown when **calculated from real, traceable data** (pantry-item-used-in-recipe events cross-referenced with estimated prices) — never fabricated (§21 explicit instruction).

## Flows Required (§27, §40 acceptance criteria 18-19)

- Trial start and expiry handling.
- Upgrade (free → premium/family).
- Downgrade/cancellation — must be as easy to find as upgrade, no dark patterns.
- Subscription restoration (reinstall/new device).
- Grace period handling on payment failure before hard downgrade.

## Explicit Non-Goal for MVP Pricing Logic

No usage-based metering complexity in V1 (e.g. per-AI-call billing to the end user) — flat tiered pricing only, to keep the mental model simple per §10 "minimise decision fatigue" applied to the business model itself.
