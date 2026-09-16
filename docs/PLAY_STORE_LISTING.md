# Google Play Store Listing — FoodPadi (Android launch)

Draft copy for the Play Console listing. Character limits are Google Play's
actual limits (2026). Nothing here claims a capability the app doesn't have —
verify against `apps/mobile` before publishing if the product changes.

## App name (30 chars max)

```
FoodPadi
```

## Short description (80 chars max)

```
Don't know what to eat? Ask FoodPadi — decide, cook, or find food nearby.
```
(75 chars)

## Full description (4000 chars max)

```
Don't know what to eat? Ask FoodPadi.

FoodPadi is a food decision assistant — not a delivery app, not a recipe
encyclopedia. Tell it what you're in the mood for, what you already have, or
how much time you've got, and it gives you a few good options instead of an
endless scroll.

DECIDE
Tell FoodPadi what you want — "something quick with chicken", "cheap dinner
for two" — and get a short list of real options, each with a plain reason
why it fits.

COOK WHAT YOU HAVE
Turn a decision into a recipe. FoodPadi shows you what you need, checks it
against what you've already got (scan your fridge or tell it), and tells you
exactly what's missing — so you buy less and waste less.

FIND FOOD NEARBY
When cooking isn't the answer, FoodPadi helps you find nearby places that
match what you're after, without turning into a delivery marketplace.

PLAN AHEAD
Turn today's decision into a week that's actually easy to follow — plan
meals, generate a shopping list, and get reminders when it's time to cook.

FOODPADI REMEMBERS
The more you use it, the more useful it gets — your usual cuisines, the
ingredients you'd rather avoid, and the patterns in how you actually eat.

TRY IT WITHOUT AN ACCOUNT
See what FoodPadi comes up with before you sign up for anything. Create a
free account when you want it to remember your recipes, plans, and
preferences.

FoodPadi gives food information and suggestions — it isn't a medical,
nutrition, or allergy-management service, and doesn't diagnose or treat
anything. See foodpadi.com/legal/disclaimer for details.
```

## Feature graphic / screenshots

- Feature graphic (1024×500): logo + "Don't know what to eat? Ask FoodPadi."
  on the brand dark-green background (matches web hero — `apps/web/app/page.module.css`'s `.hero` gradient). Not yet created.
- Screenshots — 5 of 6 captured as real, working-app screens (guest session,
  react-native-web build, not mockups): Home, a live Decide result (Chicken
  chow mein, with Cook It / Find Nearby visible), Cook Today's action cards,
  a sample Plan Ahead day, and the guest Profile screen. These prove the
  flows are real but were captured from a web-rendered build at a phone-sized
  viewport — before submitting, re-capture the same 5 shots directly from a
  real Android build (the EAS preview APK) for correct on-device fonts/safe
  areas, and add the 6th (Find Nearby's own results list, not just the
  Decide-result button that opens it).
- No mockups or invented UI — capture from a real build (§23/§28 of the launch brief: don't create fake product capabilities).

## Category & tags

- Category: **Food & Drink**
- Tags (Play Console keyword hints, not shown to users): food, cooking, recipes, meal planning, what to eat, dinner ideas

## Content rating

Standard Play Console questionnaire — nothing in FoodPadi targets a specific
age restriction; expect an "Everyone"/"PEGI 3" equivalent outcome. No user-
generated public content, no chat between strangers, no gambling.

## Data safety section (Play Console)

Must match what's actually collected — see `docs/PRIVACY_DATA_MODEL.md` and
`apps/web/app/legal/privacy/page.tsx` for the authoritative list. At minimum,
declare:
- **Collected**: email (account creation), app activity (usage events), user
  content (food preferences, saved recipes — user-provided, not shared).
- **Optional/on-request**: approximate location (Find Nearby only, not
  continuous — see `LocalFoodSearch`/`EatNowScreen`).
- **Not collected**: precise location tracking, health/medical data, financial
  info (Premium payments go through Stripe/Flutterwave directly — the app
  itself doesn't store card details), contacts, photos beyond an
  explicitly-scanned fridge/receipt photo the user chooses to analyse.
- **Data shared with third parties**: none for advertising; payment
  processors (Stripe/Flutterwave) only when subscribing.
- **Security**: data encrypted in transit (HTTPS); account deletion available
  in-app (Profile → Delete my account — `apps/mobile/src/screens/ProfileScreen.tsx`
  — a real, permanent delete via `DELETE /users/me`, not a deactivation).

This section requires a human to actually complete it in Play Console based
on the current build — this file is the source list, not a substitute for
filling in the form.

## What's new (release notes template)

```
Launch release — FoodPadi helps you decide what to eat, cook with what you
have, and find food nearby. Try it without an account, or sign in to save
your preferences and plans.
```

## Store listing links

- Privacy policy URL (required by Play Console): `https://foodpadi.com/legal/privacy`
  — currently a structured placeholder awaiting legal review (see
  `apps/web/app/legal/privacy/page.tsx`); Play Console accepts a live URL
  regardless of content maturity, but this **should be finalised with real
  legal wording before the listing goes public**, not left as a placeholder
  in production.
- Support: `https://foodpadi.com/legal/contact`
- Website: `https://foodpadi.com`

## Not yet launch-ready — do not submit until resolved

1. **Privacy policy content** is a placeholder (see above) — Play Console's
   review process increasingly checks that the linked policy actually
   reflects the app's real data practices in specific terms, not just that a
   URL exists.
2. **Feature graphic** doesn't exist yet. **Screenshots** — 5 of 6 captured
   (see above) but from a web-rendered build, not the real Android app;
   re-capture from the actual EAS APK before submitting.
3. **Data safety form** must be filled in Play Console by a human referencing
   the list above — this file only prepares the source content.
