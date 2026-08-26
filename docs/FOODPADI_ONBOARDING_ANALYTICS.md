# FoodPadi Onboarding Analytics & Experimentation Plan

Extends [ANALYTICS_PLAN.md](ANALYTICS_PLAN.md)'s existing north-star/supporting-metric model to the onboarding funnel specifically. Does not introduce a second analytics system — same event pipeline (`food_events` and friends), same principle of deriving analytics from real domain events rather than a parallel tracking SDK.

## Funnel Events

| Event | Fired when | Carries |
|---|---|---|
| `onboarding_landing_viewed` | App opened, no session | platform, referrer if available |
| `guest_session_started` | Guest token issued | sessionId |
| `guest_disclaimer_acknowledged` | Guest views/dismisses safety disclaimer | sessionId |
| `eat_now_guest_result_shown` / `cook_today_guest_result_shown` | Guest receives a real result | sessionId, resultCount |
| `signup_prompt_shown` | Contextual signup prompt rendered | triggerType (`save` \| `plan_ahead` \| `reminder` \| `shopping_list`), sessionId |
| `signup_prompt_dismissed` | User taps "Not now" | triggerType |
| `account_created` | Registration succeeds | method (`password` \| `apple` \| `google`), triggerType that led here (nullable — could be direct) |
| `disclaimer_acknowledged` | Registered user acknowledges (existing `disclaimerAcknowledgedAt` write) | — |
| `goal_selected` / `goal_skipped` | GoalScreen outcome | goalType (nullable if skipped) |
| `onboarding_completed` | `completeOnboarding` call succeeds | tookSkipPath (bool) |
| `first_food_decision` | First Eat Now selection, Cook Today recipe start, or Plan Ahead plan acceptance, post-account | decisionType |
| `first_saved_artifact` | First meal/recipe/plan actually saved | artifactType |

These map directly onto the funnel in [FOODPADI_LOGIN_ONBOARDING_RESEARCH.md](FOODPADI_LOGIN_ONBOARDING_RESEARCH.md) §12, and roll up into the existing north-star metric ("successful food decisions per active user," [ANALYTICS_PLAN.md](ANALYTICS_PLAN.md)) — guest-mode decisions count toward a separate "guest engagement" view until/unless the guest converts, at which point their subsequent activity counts normally.

## Cost Metric (new, required per the Biggest Risk in the research doc)

- **AI cost per guest session** — tracked from the first guest-mode release, not added later. Same mechanism as the existing "AI cost per active user" (`ai_conversations` token logging, [AI_ARCHITECTURE.md](AI_ARCHITECTURE.md) §Cost Control), keyed by guest `sessionId` instead of `user_id`.

## A/B Testing Plan

### Experiment 1 — Guest mode vs. login-first for Eat Now/Cook Today

- **Hypothesis:** Allowing guest use of Eat Now/Cook Today increases first-session engagement and eventual signup rate (via a contextual, earned prompt) compared to requiring login before any use.
- **Primary metric:** Day-7 retention of users who reach `first_food_decision` (guest or authenticated).
- **Secondary metrics:** `account_created` rate; `signup_prompt` → `account_created` conversion rate; time from `onboarding_landing_viewed` to `first_food_decision`; AI cost per guest session (guardrail metric, not success metric).
- **Sample requirement:** Given no existing traffic baseline (pre-launch product), treat the first 4-6 weeks post-Phase-4-launch as the measurement window rather than pre-computing a sample size; re-evaluate once real traffic volume is known.
- **Duration assumption:** Minimum 2 full weeks per arm to capture a Day-7 retention read; extend to 4 if traffic is low.
- **Success threshold:** Guest-mode arm shows equal-or-better Day-7 retention AND equal-or-better `account_created` rate than login-first arm. If guest mode increases engagement but measurably suppresses signup conversion with no retention offset, that is a genuine negative result worth acting on — this experiment is explicitly not optimising for signup count alone (per the research doc's own instruction).
- **Risks:** Confounded by the feature itself being new (novelty effect); mitigate by running both arms concurrently, not sequentially.
- **Interpretation rule:** A retention win with a signup-rate loss is evaluated on **retention**, per the research doc's explicit weighting (§12: "a strategy that increases signup but reduces retention may be worse").

### Experiment 2 — Signup trigger: persistence-action vs. free-use-count cap

- **Hypothesis:** Prompting signup at the moment of a persistence action (Save/Plan/Remind) converts better and feels less intrusive than an arbitrary "you've used this 3 times, please sign up" cap.
- **Primary metric:** `signup_prompt` → `account_created` conversion rate.
- **Secondary metrics:** `signup_prompt_dismissed` rate; Day-7 retention of converters from each trigger type; qualitative complaint rate (support/feedback mentions of "forced to sign up").
- **Success threshold:** Persistence-action trigger converts at least as well as a use-count cap, with a lower dismissal rate.
- **Risk:** A use-count cap may look better on raw conversion while damaging trust — do not declare it the winner on conversion alone; check retention and feedback sentiment before adopting.

### Experiment 3 — Goal question: mandatory vs. skippable (validating the spec change itself)

- **Hypothesis:** Making the goal question skippable does not reduce onboarding completion, and does not meaningfully reduce the eventual rate at which a goal gets set (because it gets captured later, contextually, in Plan Ahead).
- **Primary metric:** `onboarding_completed` rate.
- **Secondary metrics:** % of users with a `food_goals` row at Day 7 (comparing "skippable" cohort's eventual goal-set rate against the old forced-selection baseline, if that baseline data exists from the current build).
- **Success threshold:** Onboarding completion rate does not drop; eventual goal-set rate at Day 7 is not substantially lower than the forced-selection baseline.

## Metric Definitions Reference

All metrics here roll up into the existing supporting-metric list in [ANALYTICS_PLAN.md](ANALYTICS_PLAN.md) (DAU/WAU/MAU, retention, plan acceptance rate, etc.) — this document adds onboarding-funnel-specific and guest-mode-specific events to that existing framework, it does not define a competing metrics taxonomy.
