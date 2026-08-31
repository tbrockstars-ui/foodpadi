# FoodPadi Design System & Framer-Informed UX Strategy

**Scope:** this document covers the 17 sections requested before any design implementation, then the implementation itself is described in terms of what was actually built against the existing FoodPadi codebase (Expo/React Native mobile app + NestJS API + Neon Postgres — see [TECHNICAL_ARCHITECTURE.md](TECHNICAL_ARCHITECTURE.md)), not a parallel Framer prototype. The reasoning for that is in §1 and §13 below.

> **Status note (added later, kept for history rather than rewritten):** §1–5 and §12–17 below describe FoodPadi as it stood in an earlier, mobile-only phase — before Eat Now, Plan Ahead, and the customer-facing `apps/web` app existed. They're left as-is as a record of that pass rather than silently rewritten; treat their screen inventory and journey map as historical, not current status. **§6 (tokens) and §7 (components) are kept current** — see the update below — since those are the parts other code actually points back to. For current product scope, see [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) and [MVP_SCOPE.md](MVP_SCOPE.md).

---

## 1. Framer Template Selection Rationale

Framer's marketplace was inspected directly (framer.com/marketplace/templates). Two findings shape everything else in this document:

**Framer templates are marketing/landing-page sites, not native app UI kits.** Every template — including ones with "mobile app" in the description — is a scrollable website that *displays a static image of app screens* inside a browser/phone frame as marketing content. There is no template that ships interactive, reusable mobile-app screen components in the sense FoodPadi needs (a real Home screen, a real Cook Today flow, wired to a backend). This matters directly for §13 (Framer implementation plan): the honest, correct move is to treat Framer as a mood board, not a build target.

**Two templates were genuinely useful as inspiration, examined directly:**

- **Habitline** (Salim/Webestica, "Mobile App & Web App Landing Page") — a habit-companion app. Its hero pairs a warm, dark, photographic background with a floating mobile-mockup card showing a "Today Task" checklist: coloured checkmarks, a streak badge ("7-day streak unlocked"), calm typography. This validates the *shape* of FoodPadi's own companion card (a short, current-moment summary — "You planned chicken rice for 6:30 PM" — rather than a dashboard), and its warm/dark hero pairing informed the accent-colour direction in §6. **Rejected directly copying:** Habitline's streak/gamification mechanic — FoodPadi's product spec (§19 of the founding brief, and [PRODUCT_VISION.md](PRODUCT_VISION.md)'s "never make the user feel they failed") explicitly rules out streak-guilt mechanics; adaptability, not consistency-shaming, is the differentiator.
- **AgentLab** (Amani, "AI Agent & SaaS Template") — an enterprise AI-agent site whose product screenshot shows a prompt input bar ("How can I help you today?") with a send button, sitting above a row of suggestion chips ("Customer support agent," "Data analytics agent," ...). This is a direct, validated precedent for FoodPadi's Eat Now/Cook Today input pattern (natural-language box + quick-filter chips) — and confirms that pattern already matches how `CookTodayScreen` (built in the previous session) works today, rather than requiring a rebuild.

**General AI-template-category aesthetic** (surveyed across ~15 trending templates in the AI category): dark or near-black hero sections, one confident accent colour (never more than one saturated hue per screen), large sans-serif display type, soft-shadow floating cards, pill-shaped nav/filter chips, generous whitespace. FoodPadi adapts the *card, chip, and shadow language* from this but explicitly does **not** adopt the dark, cold, enterprise-SaaS colour direction — see §2.

**What this rules out (per the brief's own instruction not to copy a generic template):** no generic recipe-card grid, no chatbot-style full-screen message thread, no dashboard-style analytics tiles on the home screen, no dark enterprise-SaaS palette.

---

## 2. FoodPadi Design Direction

Warm, modern, trustworthy, mobile-first — already the direction set in [PRODUCT_VISION.md](PRODUCT_VISION.md) and the existing `apps/mobile/src/theme/colors.ts`. This pass **extends** that palette (see §6) rather than replacing it, and pairs it with the card/chip/shadow language pulled from Framer research above.

Explicitly avoided (per brief §19 and product spec §34):
- Clinical/medical white-and-blue health-app look (conflicts with the non-medical positioning in [AI_SAFETY_POLICY.md](AI_SAFETY_POLICY.md)).
- Childish food-emoji illustration style.
- Chat-bubble-dominant UI (conflicts with §18/§11 below).
- Dashboard-with-many-metric-tiles home screen.

---

## 3. Information Architecture

Per brief §4, simplified from FoodPadi's original 4-tab concept to match what actually exists and what's next:

```
Home (What do you need today?)
├── Eat Now        [not yet built — Phase 4]
├── Cook Today      [built]
│   └── Cook Mode   [not yet built]
├── Plan Ahead      [not yet built — Phase 3]
├── Shopping List   [not yet built — Phase 3, tied to Plan Ahead]
└── Profile         [built in this pass — was completely missing]
    ├── Food preferences & memory
    ├── Privacy (export, delete account)
    └── Disclaimer
```

Profile/settings is reached via a header icon from Home, not a bottom tab — matches brief §4's "Profile/settings can be accessed separately" and keeps the primary nav to the three-mode structure the whole product is built around.

## 4. User Journey Map

Already fully mapped in [USER_JOURNEYS.md](USER_JOURNEYS.md) (original 7 journeys) and refined per-intent in [FOODPADI_ONBOARDING_SPEC.md](FOODPADI_ONBOARDING_SPEC.md) (guest vs. account-first by mode). Not re-derived here — this document adds exactly one journey that was missing from both: **Profile / manage my data**, built in this pass:

```
Home → tap profile icon → Profile
  → "Food preferences" → view/edit cuisines, avoided ingredients → back
  → "Privacy" → "Export my data" (downloads/shows full profile JSON)
             → "Delete my account" → confirm → account + all data deleted → back to Home (guest)
  → "Disclaimer" → full safety/disclaimer text
  → "Log out"
```

## 5. Screen Inventory

Mapped against the 26 screens the brief lists, honestly marked by actual status:

| # | Screen | Status |
|---|---|---|
| 1 | Landing/Home | ✅ Home (guest + authenticated variants) |
| 2 | Login | ✅ |
| 3 | Account creation | ✅ |
| 4 | Onboarding/preferences | ✅ Disclaimer → Goal → Preferences (all skippable except Disclaimer) |
| 5 | Home dashboard | ✅ (deliberately not a dashboard — see §2) |
| 6 | Eat Now | ⬜ Phase 4 |
| 7 | Eat Now results | ⬜ Phase 4 |
| 8 | Food detail | ⬜ Phase 4 |
| 9 | Cook Today | ✅ |
| 10 | Meal recommendations | ✅ (Cook Today's results step) |
| 11 | Cook Mode | ⬜ not built |
| 12 | Plan Ahead | ⬜ Phase 3 |
| 13 | Meal plan detail | ⬜ Phase 3 |
| 14 | Change meal | ⬜ Phase 3 |
| 15 | Plan Rescue | ⬜ blocked on Plan Ahead existing (§10 note below) |
| 16 | Shopping List | ⬜ Phase 3 |
| 17 | Food preferences | ✅ built this pass (folded into Profile) |
| 18 | Food Memory | 🟡 backend model (`ai_memory`) exists, no UI yet — needs the memory controller from [FOODPADI_PERSONALISATION_SPEC.md](FOODPADI_PERSONALISATION_SPEC.md) first |
| 19 | Notifications/reminders | ⬜ Phase 5 |
| 20 | Profile | ✅ built this pass |
| 21 | Privacy settings | ✅ built this pass (folded into Profile: export + delete) |
| 22 | Disclaimer | ✅ (already existed for onboarding; now also linked from Profile) |
| 23 | Subscription/Premium | ⬜ Phase 7 |
| 24 | Empty states | ✅ shared `EmptyState` component built this pass |
| 25 | Loading states | ✅ shared `LoadingState` component built this pass |
| 26 | Error states | 🟡 handled inline per-screen today (e.g. Cook Today's friendly 503 message); no shared component yet — see backlog |

**Plan Rescue note:** the brief calls this the key differentiator, but it is structurally a *response to a Plan Ahead meal falling through* — it cannot be a real, wired screen until Plan Ahead (Phase 3) exists to rescue *from*. Building a static mock of it now would be exactly the "fake UI that requires a complete redesign" the brief itself warns against (§23/§34). It's fully specified in [PRODUCT_VISION.md](PRODUCT_VISION.md)/[IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) Phase 5 and will reuse the `Card`/`Chip` components built here.

## 6. Design System

**Current as of the web visual-revamp pass.** `apps/mobile/src/theme/colors.ts` is the source of truth; `apps/web/app/globals.css` mirrors it exactly as CSS custom properties (`--primary`, `--space-md`, `--radius-lg`, …) so the two platforms can't silently drift into two different palettes. Web's tokens are named `kebab-case` with a `--` prefix; mobile's are the `camelCase` object keys below — same values, platform-native naming.

| Token (mobile key / web var) | Value | Use |
|---|---|---|
| `primary` / `--primary` | `#2F6B4F` (forest green) | Primary actions, selected states |
| `secondary` / `--secondary` | `#C2760C` (warm amber) | Tags, highlights, secondary emphasis |
| `success` / `--success` | `#3B7A3B` | Confirmations |
| `warning` / `--warning` | `#B7791F` | Non-blocking caution |
| `danger` / `--danger` | `#B3261E` | Errors, destructive actions |
| `background` / `--background` | `#FBFAF7` | Screen background |
| `surface` / `--surface` | `#FFFFFF` | Cards |
| `surfaceSunken` / `--surface-sunken` | `#F4F2EC` | Inset wells (search inputs, skeletons) |
| `text` / `textMuted` / `textFaint` | near-black / grey / light grey | Content hierarchy |
| `border` / `borderStrong` | light grey / darker grey | Default vs. emphasized dividers |

Each of `primary`/`secondary`/`success`/`warning`/`danger` also has a `*Soft` tint (e.g. `primarySoft` / `--primary-soft`) for low-emphasis fills (badges, selected chips) — same pattern on both platforms.

**Spacing:** `spacing.*` (mobile) / `--space-*` (web), a 4→32px scale (`xs` 4, `sm` 8, `md` 12, `lg` 16, `xl` 24, `xxl` 32). **Radius:** `radius.*` / `--radius-*` (`sm` 8, `md` 12, `lg` 16, `xl` 24, `pill` 999). **Typography** (mobile `typography.*`; web sets these directly per class, no shared type-scale variables yet — see backlog): `display` (28px/700, screen titles), `title` (20px/700), `subtitle` (15px/500), `body` (15px/400, 22px line-height), `caption` (13px), `label` (12px/600, uppercase section labels).

**Elevation:** mobile's `shadow.card` / `shadow.raised` (React Native `shadow*` + Android `elevation` props, colour `#14150F`) were the starting point. Web didn't have equivalent shared tokens until this pass — ~18 individual CSS modules each hand-wrote their own `box-shadow` value, and several had silently drifted from each other (`0.05` vs `0.06` opacity for what was meant to be the same resting-card shadow; the two floating support buttons on `/` and the Home hub differed `0.2` vs `0.25`). Consolidated into a shared scale in `globals.css`, and every CSS module updated to reference it instead of repeating the literal value:

| Web var | Value | Use |
|---|---|---|
| `--shadow-sm` | `0 2px 10px rgba(20,21,15,.05)` | Resting card (matches mobile `shadow.card`) |
| `--shadow-md` | `0 8px 24px rgba(20,21,15,.12)` | Raised panels (dropdowns, popovers) |
| `--shadow-lg` | `0 10px 24px rgba(20,21,15,.14)` | Card hover/focus elevation |
| `--shadow-badge` | `0 2px 8px rgba(20,21,15,.2)` | Small circular icon badges |
| `--shadow-fab` | `0 4px 16px rgba(20,21,15,.22)` | Fixed floating action buttons |

(Mobile's `shadow.raised` at `0.1` opacity and web's `--shadow-md` at `0.12` differ slightly — both were independently tuned per-platform before this pass and left alone rather than forced to match a shared literal; RN's `shadowOpacity` and CSS's `box-shadow` alpha don't composite identically against their respective backgrounds anyway, so exact parity isn't the goal, consistency *within* each platform is.)

## 7. Component Architecture

**Mobile** — real, reusable React Native components in `apps/mobile/src/components/`:

| Component | File | Replaces |
|---|---|---|
| `Button` | `Button.tsx` | Repeated primary/secondary `TouchableOpacity` + `StyleSheet` pairs |
| `Card` | `Card.tsx` | Repeated `{ backgroundColor: surface, borderRadius, ...shadow.card }` |
| `Chip` | `Chip.tsx` | Repeated selectable-pill pattern |
| `Tag` | `Tag.tsx` | Promoted from a private `CookTodayScreen` helper |
| `EmptyState` / `LoadingState` | `EmptyState.tsx` / `LoadingState.tsx` | Shared empty/loading treatment |
| `DisclaimerBanner` | `DisclaimerBanner.tsx` | Compact disclaimer strip, distinct from the full-text screen |
| `FoodImage` | `FoodImage.tsx` | The representative food photo on recommendation cards — skeleton while loading, icon fallback on no-image/error, fade-in, provider attribution. Backed by the API's `food-image` module (Pexels/Unsplash search + cache), not a static asset. |
| `BackLink` | `BackLink.tsx` | The "‹ Home"-style back navigation, now one pill+chevron component instead of ad hoc per-screen text links |

**Web** — the equivalent layer in `apps/web/components/`, built later as the web app grew from a landing page into the full customer-facing product (§1's "no separate Framer site" call turned out to also mean "no separate design language" — web reuses the same tokens and the same component *shapes*, implemented as CSS Modules instead of `StyleSheet`):

| Component | File | Mirrors |
|---|---|---|
| `Card` | `Card.tsx` | Mobile `Card.tsx` — same shadow/radius/padding tokens |
| `FoodImage` | `FoodImage.tsx` | Mobile `FoodImage.tsx` — same skeleton/fallback/attribution behaviour, `<img>` instead of `Animated.Image` |
| `Logo` | `Logo.tsx` | The FoodPadi mark + wordmark, used consistently across every app-shell page and the auth pages (mobile doesn't need this as a separate component — its header just renders the mark directly) |
| `BackLink` | `BackLink.tsx` | Mobile `BackLink.tsx` |
| `IntentCard` (`components/motion/`) | `IntentCard.tsx` | No direct mobile equivalent yet — the photo + accent-colour + badge "journey" card for Cooking/Plan ahead on the web Home hub |

Both platforms' `DecideFlow` component (`apps/web/app/DecideFlow.tsx` / `apps/mobile/src/components/DecideFlow.tsx`) independently converged on the same option-card shape (image → title/reason → type badge → action), kept in sync by hand rather than a shared cross-platform component, since React Native and CSS Modules can't share JSX — see each file's own comments for the other's location.

## 8. Responsive Strategy

Unchanged from the existing approach (already mobile-first React Native, already verified on both native-shaped and wide web viewports via `expo start --web` in prior sessions): `flexWrap` grids for card rows, no fixed pixel widths on containers, large touch targets (44pt minimum, already the norm in existing `TouchableOpacity` sizing). No new breakpoint system was introduced — RN's flexbox layout already reflows acceptably from phone width to the ~830px wide preview browser used for testing; a dedicated tablet/desktop layout pass is out of scope for MVP (matches brief §21's "primary target: mobile").

## 9. Authentication/Onboarding UX

Unchanged — fully specified and built in [FOODPADI_ONBOARDING_SPEC.md](FOODPADI_ONBOARDING_SPEC.md) and [FOODPADI_AUTHENTICATION_SPEC.md](FOODPADI_AUTHENTICATION_SPEC.md): guest access for Eat Now/Cook Today, account-first for Plan Ahead, signup triggered by the first persistence action, goal/preferences both skippable. Not re-litigated here.

## 10. Privacy/Security UX

Builds directly on [PRIVACY_DATA_MODEL.md](PRIVACY_DATA_MODEL.md) and [SECURITY_MODEL.md](SECURITY_MODEL.md). The concrete UX gap this pass closes: **there was no in-app way to view/edit food preferences after onboarding, export data, or delete an account** — the API endpoints existed (`/users/me/export`, `DELETE /users/me`, preferences CRUD) but no screen called them. This directly fails acceptance-scenario 7 in brief §32 ("can the user find the option to delete their account?") — answer was previously **no**. The new Profile screen fixes this.

## 11. AI Interaction Patterns

Already matches brief §18's guidance (cards-not-chat): `CookTodayScreen`'s ingredient-chip input and card-based results were built without a chat interface in the prior session, so no rework was needed here — confirmed as correct by this review rather than changed.

## 12. MVP Implementation Plan

See [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) for the authoritative phase plan. This pass's work fits inside Phase 1 (Profile/privacy controls — §32 of the original spec calls this out as required MVP scope, "Privacy controls" — it existed at the API layer but not the UI layer until now).

## 13. Framer Implementation Plan

**No separate Framer site is being built.** Reasoning, directly from the brief's own rules (§23 point 8, §34): a Framer prototype cannot be wired to FoodPadi's real NestJS/Postgres backend without significant custom embed work, so building one would produce exactly the "fake UI that would require a complete redesign when connected to production APIs" the brief prohibits. FoodPadi's mobile app is already live against real infrastructure (auth, Cook Today, Neon Postgres) — extending it directly, informed by Framer's visual/interaction language (§1), is the implementation path that satisfies the brief's intent without violating its own constraint.

If a public marketing/landing presence is wanted in Framer's actual product (as opposed to the existing Next.js landing page in `apps/web`), that is a separate, explicit future decision — not assumed here.

## 14. Future Backend Integration Requirements

None new. The Profile screen calls only endpoints that already exist: `GET /users/me`, `GET/POST/DELETE /users/me/preferences[/:id]`, `GET/POST/DELETE /users/me/avoided-ingredients[/:id]`, `GET /users/me/export`, `DELETE /users/me`, `POST /auth/logout`. No API changes were required for this pass.

## 15. Security Review

Walking the exact 14-point checklist from brief §30 against the app as it exists after this pass:

1. Unnecessary sensitive fields collected? No — Profile only surfaces existing preference/avoided-ingredient fields, nothing new requested.
2. Medical questions present? No.
3. Allergy-safety claims present? No — Profile's disclaimer link reuses the exact existing `DISCLAIMER_TEXT`.
4. Location requested unnecessarily? No location feature exists yet at all (Eat Now is unbuilt) — not applicable yet, correctly deferred.
5. Private user details exposed? No — Profile shows only the current user's own data, authenticated via the existing `JwtAuthGuard`.
6. Authentication states clear? Yes — Profile is unreachable without a real account (guests don't have one to manage); the guest Home has no Profile entry point.
7. Admin functions separated? Yes, unchanged — `apps/web`'s admin surface remains entirely separate, never linked from the mobile app.
8. Private URLs avoided? Yes — no user ID, email, or token is ever placed in a URL; all calls are authenticated `fetch` requests with a bearer header.
9. Could the frontend expose secrets? No new secrets touched; the export/delete calls use the same bearer-token pattern as every other authenticated call.
10. Could a user mistake demo data for live? N/A for this pass (Profile shows only the user's own real data, not demo content).
11. Privacy controls accessible? **Yes now** — this was the gap being closed.
12. Account deletion represented? **Yes now** — previously absent from the UI entirely.
13. Can users manage stored preferences? **Yes now** — view and delete individual preferences/avoided ingredients.
14. AI output presented as recommendations, not medical advice? Unchanged from Cook Today's existing safety-notice footer — not touched in this pass.

## 16. Accessibility Review

- `accessibilityRole`/`accessibilityLabel` continue to be set on interactive elements in the new `Button`/`Chip` components (centralizing this actually improves consistency — previously it depended on each screen remembering to add it).
- Destructive action (delete account) uses a confirmation step, not a single tap — satisfies "no important action reachable by accident."
- Colour is not the sole state indicator: the new `Chip`/`Button` selected states pair colour with a border-weight/background change, not colour alone.
- **Not yet done, flagged honestly:** no automated contrast audit has been run against the extended palette; reduced-motion handling is not implemented anywhere in the app yet (no animations exist to reduce, so not currently a gap, but will need addressing once any transition/animation is added). Both tracked as P2 in the backlog below, not silently skipped.

## 17. Final MVP UX Checklist

Walking brief §32's 8 scenarios against the app as it exists now:

1. Hungry, £8 → useful recommendation quickly? Eat Now doesn't exist yet (Phase 4) — **not yet satisfiable**, correctly scoped as a known gap rather than faked.
2. Chicken/rice/peppers → something to cook quickly? **Yes** — Cook Today, built and verified live.
3. 3-day meal plan without confusion? Plan Ahead doesn't exist yet (Phase 3) — **not yet satisfiable**.
4. Doesn't want to cook tonight → rescue the plan? Blocked on Plan Ahead existing (§5 note above) — **not yet satisfiable**.
5. Save a meal → is account creation understandable? **Yes** — verified live in the prior session (contextual signup prompt, guest → account flow).
6. Change preferences easily? **Yes now** — Profile screen, built this pass.
7. Find the delete-account option? **Yes now** — Profile screen, built this pass. Previously **no** — a real, now-closed gap.
8. "Is this safe for my allergy?" avoids a medical claim? **Yes** — unchanged, enforced by `AI_SAFETY_POLICY.md`'s existing pattern.

---

## Backlog (this pass)

**P0 (built in this pass):** `Button`/`Card`/`Chip`/`Tag`/`EmptyState`/`LoadingState`/`DisclaimerBanner` components; `ProfileScreen` (preferences view/edit, avoided ingredients, export, delete account, disclaimer link, log out); navigation entry from Home.

**P1:** shared error-state component (currently handled inline per-screen); `ai_memory` controller + Food Memory UI (needs [FOODPADI_PERSONALISATION_SPEC.md](FOODPADI_PERSONALISATION_SPEC.md)'s backend work first).

**P2:** contrast audit against the extended palette; reduced-motion handling once any animation exists; tablet/desktop layout pass.

**P3:** Framer as an actual public-site tool, if ever wanted for `apps/web`'s marketing surface specifically (separate decision, not assumed).
