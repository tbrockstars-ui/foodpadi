# Notification Strategy

## Governing Rule (§37)

Every notification must answer: **"Why does the user need this now?"** If it can't, it doesn't ship. Notifications exist to serve a decision the user is about to make, not to drive engagement metrics.

## Notification Categories

| Category | Trigger | Example |
|---|---|---|
| Meal confirmation | A planned meal's scheduled time is approaching | "You planned chicken rice for 6:30 PM. Still good?" |
| Shopping proximity | User is near a supermarket AND has missing items for an accepted plan | "You're near a supermarket. You have 4 items missing for tomorrow's meals." |
| Food waste | A pantry item has a likely-soon expiry (only where reliable signal exists) | "You have ingredients that may need using soon. Want ideas?" |
| Day-ahead planning nudge | Morning, only if the day's plan needs a decision | "You've got a busy day. Want a 15-minute dinner tonight?" |
| Weekly planning check-in | End of a plan's scope, only if the user hasn't already decided | "Want me to plan next week or keep it flexible?" |

No other categories ship without a documented trigger condition added to this table first.

## User Controls (mandatory, not optional polish)

- Per-category enable/disable.
- Quiet hours (user-defined window, respected server-side at send time, not just client-side suppression).
- Frequency cap per category (server-enforced, e.g. max 1 waste alert/day regardless of how many items qualify).
- Global opt-out.

## What This Explicitly Avoids

- Generic re-engagement pushes ("We miss you!").
- Multiple stacked notifications for the same underlying decision.
- Notifications framed as failure/guilt ("You didn't cook your planned meal") — see [AI_SAFETY_POLICY.md](AI_SAFETY_POLICY.md)-adjacent tone rules in the companion personality spec (§19).

## Delivery

Expo push notifications (APNs/FCM under the hood) for delivery only; a backend scheduler/queue owns *if and when* to send based on the trigger table above, plan state, and user preference — the LLM does not decide to send a notification, it may only be used to phrase one whose sending was already decided deterministically.
