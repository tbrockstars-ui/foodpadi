# Referral Foundation — Implementation Plan ("Feed a Friend")

Implementation record for the Phase 1 referral foundation from the "Feed a
Friend" strategy brief. **Phase 1 (attribution + rewards) is built** — see
Status. Sections 1–2 are the original codebase-mapped plan; the checklists in
2.10 / 2.11 track what shipped.

Source strategy: member gets a personal link → friend tries FoodPadi → friend
completes a meaningful action → friend registers → **qualified** referral → both
sides rewarded (recognition).

---

## Status

**Phase 1 — complete.** 1a (attribution) + 1b (rewards) are built and green:
api build + 76 tests, web production build, mobile typecheck. Referral is a
key acquisition channel, so the loop lives *in the product*, not just a
settings page.

The full loop now works end to end:

> personal link → friend opens `/?ref=CODE` (cookie captured) → tries FoodPadi
> (guest) → registers (code attached from cookie) → does a qualifying action →
> referral flips to **qualified** → **both sides earn recognition**
> (friend: "Joined via a friend" badge + welcome banner; referrer: tier badge)
> → referrer sees progress + next tier on `/invite`; contextual "share
> FoodPadi" nudges appear after a decision.

### Reward model (cost-safe)

Per strategy §11 and the "don't give away expensive usage" constraint, the
Phase 1 reward is **status / recognition**, not a paid perk. `Referral.status`
= `rewarded` stays reserved for a future Plus-days / ad-free grant — that
becomes a new `ReferralMilestone.kind` (or its own table) with a grant call in
`markQualifiedIfPending`; nothing else changes.

Referrer tier ladder (`REFERRAL_TIERS` in `packages/shared`, authoritative
resolution in the API):

| Qualified friends | Tier |
|---|---|
| 1 | 🌱 First Invite |
| 3 | 🧭 Food Explorer |
| 5 | ⚡ Super Connector |
| 10 | 👑 FoodPadi Ambassador |

### Decisions taken during the build (see §5 for the original open questions)

| # | Decision | Choice made |
|---|---|---|
| 1 | Interim shared-link target | `/?ref=CODE` — middleware captures the code on any matched route into the `fp_ref` cookie. (A web guest flow now exists — the loop is fully "try before register" on web.) |
| 2 | Analytics ↔ referrals coupling | `ReferralsService` depends on Prisma only; the global `AnalyticsModule` imports `ReferralsModule` for the qualification hook; `referral_attributed` emitted from `AuthService`. `ReferralsController` deliberately does **not** depend on `AnalyticsService` (would close a module cycle) — share/dashboard telemetry is a later add via an event emitter |
| 3 | `invited` (click) count | Dropped. Dashboard shows **joined** + **qualified** only |
| 4 | Reward | **Recognition** (tier badges + friend welcome badge), not a paid perk. `markQualifiedIfPending` tops up referrer tiers; `attributeOnRegister` mints the friend's welcome badge. `rewarded` status still reserved for real perks |
| 5 | Qualifying events | The 5-event allowlist, in `referrals/qualifying-events.ts` |

### Still required before it works at runtime

Not run here — the API dev server in another session holds the Prisma engine
binary, and the migrations target the shared dev DB:

```bash
npm exec --workspace=@foodpadi/api -- prisma generate
npm exec --workspace=@foodpadi/api -- prisma migrate deploy
#   applies 20260902120000_add_referrals + 20260902130000_add_referral_milestones
```

### Endpoints (all `JwtAuthGuard`)

| Route | Purpose |
|---|---|
| `GET /referrals/me` | Dashboard: code, link, counts, tier + next-tier progress, unseen badges, recent list |
| `POST /referrals/code` | Force-mint the code (copy button) |
| `GET /referrals/link` | Link only — lightweight call for the in-flow share nudges |
| `POST /referrals/milestones/ack` | Dashboard calls after showing a badge celebration |
| `GET /referrals/received` · `POST /referrals/received/ack` | Friend-side welcome banner |
| `POST /referrals/share` | Channel report — validated no-op until share analytics lands |

### Surfaces

- **Web** — `/invite` dashboard (link, WhatsApp/Copy/native share, counts, **tier + progress ladder**, **badge celebration**); `<ShareNudge context="decision">` in `DecideFlow` after results; `<FriendWelcomeBanner>` on `HomeHub`; HomeHub invite card; SettingsMenu link. `ShareNudge` is reusable for `cook` / `plan` contexts — only `decision` is wired in.
- **Mobile** — "Share FoodPadi" card in `ProfileScreen` (outbound only); `api.getReferralSummary` / `api.trackReferralShare`. Tier display + inbound deep-link attribution are deferred.

---

## 1. Current state (what already exists)

| Capability | State | Where |
|---|---|---|
| Guest sessions (use decision engine without an account) | **Built**, mobile + API | [`guest-session.service.ts`](../apps/api/src/modules/auth/guest-session.service.ts), [`guest-or-auth.guard.ts`](../apps/api/src/modules/auth/guest-or-auth.guard.ts), [`GuestSessionContext.tsx`](../apps/mobile/src/auth/GuestSessionContext.tsx) |
| Web public entry | **Waitlist only** — no guest decision flow on web yet | [`apps/web/app/page.tsx`](../apps/web/app/page.tsx) (unauthenticated branch renders the marketing/waitlist page) |
| Contextual signup prompt at conversion moments | **Built**, mobile | [`SignupPromptModal.tsx`](../apps/mobile/src/components/SignupPromptModal.tsx) |
| Analytics from real domain events (`food_events`) | **Built** — single chokepoint | [`analytics.service.ts`](../apps/api/src/modules/analytics/analytics.service.ts), `@Global()` [`analytics.module.ts`](../apps/api/src/modules/analytics/analytics.module.ts) |
| Registration (password + Google) | **Built** | [`auth.service.ts`](../apps/api/src/modules/auth/auth.service.ts) `register()` / `loginWithGoogle()` |
| Web register → cookie session | **Built** | [`apps/web/app/api/auth/register/route.ts`](../apps/web/app/api/auth/register/route.ts), [`middleware.ts`](../apps/web/middleware.ts) |
| Subscription / entitlement / Premium | **Not built** — planned (RevenueCat + entitlement model) | [`docs/SUBSCRIPTION_MODEL.md`](SUBSCRIPTION_MODEL.md), [`docs/MVP_SCOPE.md`](MVP_SCOPE.md) row 16 |
| Referral / invite | **Nothing** — no model, module, code, or UI | — |
| Mobile deep-link scheme | **Not configured** — no `scheme` in [`apps/mobile/app.json`](../apps/mobile/app.json) | — |

### Consequences

1. **The hardest prerequisite (guest mode) is already done** in the API. The
   `?ref=` → try → register loop is attribution plumbing, not a new capability.
2. **Rewards that grant Premium can't ship until the entitlement model exists.**
   Split the work: **1a attribution now**, **1b rewards after** the subscription
   foundation lands (or against a cheaper non-Premium reward — see §7).
3. **Referral MVP is web-first.** Mobile inbound attribution needs a deep-link
   scheme + deferred-deep-link/install attribution — a separate project. Mobile
   users can still *share* their link (it's a web URL); mobile *inbound* is out
   of scope for 1a.
4. **The `?ref` code must not depend on the web guest flow.** Capture it into a
   cookie on any route in middleware, independent of whether the visitor lands
   on the waitlist page or (later) a guest decision experience.

---

## 2. Phase 1a — Attribution (ship first)

Goal: every member has a link; clicks are attributed; a referred registration
creates a tracked `Referral`; a meaningful action by the referred user flips it
to `qualified`; the member sees invited/joined/qualified counts. **No reward
grant yet** — `qualified` is a terminal state for 1a.

### 2.1 Schema — `apps/api/prisma/schema.prisma`

Add one column to `User` and one new model. New migration
`apps/api/prisma/migrations/<ts>_add_referrals/`.

```prisma
model User {
  // ...existing...
  referralCode        String?    @unique @map("referral_code") // minted lazily on first "get my link"
  referralsMade       Referral[] @relation("Referrer")
  referralReceived    Referral?  @relation("Referred")
}

// One row per referred person (unique on referredUserId — a person can only be
// "the friend" once, ever). Follows the same "derive from real events, don't
// build a parallel tracker" principle as FoodEvent.
model Referral {
  id             String    @id @default(uuid())
  referrerUserId String    @map("referrer_user_id")
  referrer       User      @relation("Referrer", fields: [referrerUserId], references: [id], onDelete: Cascade)
  referredUserId String    @unique @map("referred_user_id")
  referred       User      @relation("Referred", fields: [referredUserId], references: [id], onDelete: Cascade)
  codeUsed       String    @map("code_used")
  status         String    @default("pending") // "pending" | "qualified" | "rewarded"
  // Signup fingerprint for later abuse review — hash only, never raw IP
  // (docs/PRIVACY_DATA_MODEL.md). Not used for automated blocking in 1a.
  signupIpHash   String?   @map("signup_ip_hash")
  createdAt      DateTime  @default(now()) @map("created_at")
  qualifiedAt    DateTime? @map("qualified_at")
  rewardedAt     DateTime? @map("rewarded_at")

  @@index([referrerUserId])
  @@index([status])
  @@map("referrals")
}
```

Decisions baked in:
- **`referralCode` on `User`, minted lazily**, not at registration — keeps the
  register path untouched and avoids generating codes for accounts that never
  share. Nullable + `@unique`.
- **`Referral.referredUserId` is `@unique`** — the anti-abuse "reward once per
  referred person" rule is a DB constraint, not app logic.
- **`status` as a string enum** — matches the existing convention in this schema
  (`MealPlan.status`, `Recipe.source`, etc. are all string unions, no Prisma
  enums used anywhere).

### 2.2 API — new `referrals` module

`apps/api/src/modules/referrals/` — `referrals.module.ts`, `referrals.controller.ts`,
`referrals.service.ts`, `referrals.service.spec.ts`. Register in
[`app.module.ts`](../apps/api/src/app.module.ts).

**`ReferralsService`**
| Method | Purpose |
|---|---|
| `getOrCreateCode(userId)` | Returns `user.referralCode`, generating a collision-checked code (`crypto`, `REFERRAL_CODE_LENGTH` default 7, unambiguous alphabet, no profanity) on first call. |
| `getSummary(userId)` | `{ code, link, counts: { invited, joined, qualified } }` — `invited` = distinct click cookies is not tracked server-side in 1a, so `invited` = `joined` for now (or drop it; see §9). `joined` = `Referral` count, `qualified` = status ≥ qualified. |
| `listReferrals(userId)` | Recent `Referral` rows for the dashboard (redacted — no referred email, just masked handle + status + date). |
| `attributeOnRegister({ referredUserId, code, ipHash })` | Resolve `code` → referrer `User`. **Reject self-referral** (`referrer.id === referredUserId`). Create the `Referral` row (`pending`). Swallow duplicate/unknown-code errors — a bad ref code must never block registration. Emits `referral_attributed` analytics event. |
| `markQualifiedIfPending(userId)` | Single idempotent `updateMany({ where: { referredUserId: userId, status: 'pending' }, data: { status: 'qualified', qualifiedAt: now } })`. Emits `referral_qualified` when a row changes. |

**`ReferralsController`** (all `@UseGuards(JwtAuthGuard)`)
| Route | Handler |
|---|---|
| `GET /referrals/me` | `getSummary` + `listReferrals` |
| `POST /referrals/code` | `getOrCreateCode` (idempotent; `GET /referrals/me` also mints, this is just an explicit trigger for the "Copy link" button) |

No new guest endpoints. No public referral endpoint — code resolution happens
server-side inside `attributeOnRegister`, never exposed to the client.

### 2.3 API — registration hook

- **`RegisterDto`** ([`register.dto.ts`](../apps/api/src/modules/auth/dto/register.dto.ts)):
  add `@IsOptional() @IsString() @MaxLength(16) referralCode?: string`.
- **`AuthService.register`**: after the `user` is created, if `dto.referralCode`
  is set, `await this.referrals.attributeOnRegister(...)` inside the same flow
  but **non-fatally** (wrap; log and continue on any error). Requires importing
  `ReferralsModule` into `AuthModule` (or moving `attributeOnRegister` behind an
  event — a direct call is fine for MVP; watch for a circular module ref, break
  it with `forwardRef` if needed).
- **`AuthService.loginWithGoogle`**: same hook on the **new-account** branch only
  (the `prisma.user.create` path), not the existing-account branch.
- Thread a hashed client IP from the controller (`@Ip()` → `sha256`) into
  `register` for `signupIpHash`. Web calls arrive via the proxy/route handler, so
  forward `x-forwarded-for` from [`register/route.ts`](../apps/web/app/api/auth/register/route.ts).

### 2.4 API — qualification hook

The referred user "does something meaningful" = fires one of a small allowlist
of `food_events`. `AnalyticsService.track` is the one chokepoint every meaningful
action already passes through.

- Add `apps/api/src/modules/referrals/qualifying-events.ts`:
  ```ts
  export const REFERRAL_QUALIFYING_EVENTS = new Set([
    'decide_options_generated',
    'cook_today_recipes_generated',
    'eat_now_searched',
    'plan_ahead_accepted',
    'cook_today_recipe_saved',
  ]);
  ```
- In [`analytics.service.ts`](../apps/api/src/modules/analytics/analytics.service.ts)
  `track()`: after the `foodEvent.create`, if `actor.userId && REFERRAL_QUALIFYING_EVENTS.has(eventType)`,
  fire-and-forget `this.referrals.markQualifiedIfPending(actor.userId)`.
  `AnalyticsModule` is `@Global()`; inject `ReferralsService` into it (or, to
  keep analytics dependency-free, have `ReferralsService` subscribe via an event
  emitter — a direct injection is acceptable for MVP, note the coupling).
- `markQualifiedIfPending` is one indexed conditional write; on the ~99% of
  calls where the user has no pending referral it updates 0 rows. Cheap enough
  to run inline.

### 2.5 Web

| File | Change |
|---|---|
| [`apps/web/middleware.ts`](../apps/web/middleware.ts) | Widen `matcher` to include `/` and `/register`. If `?ref=<code>` is present and no `fp_ref` cookie exists yet, set `fp_ref` (90d, `httpOnly`, `sameSite: lax`, `path: /`). First-touch wins. Strip `?ref` from the URL with a redirect so it doesn't linger in history/share. This runs regardless of the waitlist-vs-guest question. |
| [`apps/web/app/api/auth/register/route.ts`](../apps/web/app/api/auth/register/route.ts) | Read `fp_ref` cookie, add `referralCode` to the body forwarded to `/auth/register`. Forward `x-forwarded-for`. On success, `response.cookies.delete('fp_ref')`. |
| `apps/web/app/register/page.tsx` | No change needed (code rides the cookie). Optionally show "You were invited by a friend 🎉" if a `fp_ref` cookie is readable — needs a tiny server component wrapper since the cookie is `httpOnly`. Nice-to-have, not required. |
| **new** `apps/web/app/invite/page.tsx` + `InviteView.tsx` | The dashboard from strategy §15: the link, **WhatsApp** (primary) + Copy + Web Share API buttons, and "X invited · Y joined · Z qualified". Server component fetches `GET /referrals/me` via `serverApi`; client child owns the share/copy interactions. |
| [`apps/web/app/HomeHub.tsx`](../apps/web/app/HomeHub.tsx) | Add the small "Know someone who always says 'I don't know what to eat'?" card (strategy §4) linking to `/invite`. |
| WhatsApp link format | `https://wa.me/?text=<encoded>` with the message from strategy §5 and the `https://foodpadi.app/?ref=<code>` link. |

**Interim landing behaviour:** until a web guest decision experience exists, a
`?ref` link lands the friend on the current waitlist page (cookie still captured;
attribution completes whenever they later register). Acceptable for 1a. If you
want the referred visitor to hit registration directly in the interim, point the
shared link at `https://foodpadi.app/register?ref=<code>` instead — a one-line
change in the share helpers, reversible when guest-web ships.

### 2.6 Shared types — [`packages/shared/src/dto.ts`](../packages/shared/src/dto.ts)

```ts
export interface RegisterRequest { /* ...+ */ referralCode?: string }

export interface ReferralSummary {
  code: string;
  link: string;
  counts: { invited: number; joined: number; qualified: number };
  recent: ReferralListItem[];
}
export interface ReferralListItem {
  maskedHandle: string;        // "j••@gmail.com" — never the full email
  status: 'pending' | 'qualified' | 'rewarded';
  createdAt: string;
}
```

### 2.7 Mobile (1a scope: minimal)

- **In scope:** a "Share FoodPadi" entry (Profile + post-decision, strategy §4)
  that fetches `GET /referrals/me` and opens the native share sheet with the web
  link. Outbound only.
- **Out of scope:** inbound attribution on mobile (needs `scheme` in `app.json`,
  Android App Links / iOS Universal Links, and deferred-deep-link handling for
  the install case). Tracked separately — do not block 1a on it.

### 2.8 Analytics events to add

`referral_attributed` (referrer + referred ids, code), `referral_qualified`,
`referral_link_shared` (channel: whatsapp | copy | native), `referral_dashboard_viewed`.
Add to the client-event allowlist if any are reported from the web/mobile client
(cf. `GOAL_CLIENT_EVENT_TYPES` in shared).

### 2.9 Anti-abuse — 1a minimum (strategy §16)

Build these now; they're cheap and load-bearing:
- Self-referral blocked in `attributeOnRegister` (id comparison).
- One `Referral` per referred user — DB unique constraint.
- `qualified` requires a real event — already the design.
- `signupIpHash` stored for manual review (no auto-block yet).
- Reward (1b) only ever fires on `qualified` → `rewarded` transition, once.

Deferred to 1b/Phase 3: disposable-email rejection, device fingerprinting,
per-referrer reward rate-limit (`REFERRAL_MAX_REWARDS_PER_MONTH`).

### 2.10 Task checklist — 1a

- [x] Prisma: `referralCode` on `User` + `Referral` model + migration (`20260902120000_add_referrals`)
- [x] `referrals` module: service + controller + spec, wired into `app.module.ts`
- [x] `getOrCreateCode` with collision-checked generation + `REFERRAL_CODE_LENGTH` config, unambiguous alphabet
- [x] `attributeOnRegister` (self-referral guard, soft-deleted referrer guard, non-fatal, SHA-256 IP hash)
- [x] `markQualifiedIfPending` + `qualifying-events.ts`
- [x] Hook into `AnalyticsService.track` (`@Optional()` `ReferralsService`; `AnalyticsModule` imports `ReferralsModule`)
- [x] `RegisterDto.referralCode` + `GoogleAuthDto.referralCode`; `AuthService.register` + Google new-account branch; controller forwards `x-forwarded-for` → hashed
- [x] Shared DTO types (`RegisterRequest`/`GoogleAuthRequest.referralCode`, `ReferralSummary`, `ReferralListItem`, `ReferralStatus`, `ReferralShareChannel`)
- [x] Web middleware `?ref` → `fp_ref` cookie (first-touch, strips param via redirect); matcher widened
- [x] Web register **and google** route forward `referralCode` + `x-forwarded-for`, clear cookie on success
- [x] `/invite` dashboard page — `InviteView` (WhatsApp + Copy + native Web Share, joined/qualified counts, recent list with masked handles)
- [x] Entry points: HomeHub invite card + SettingsMenu link
- [x] Mobile: `getReferralSummary`/`trackReferralShare` client methods + "Share FoodPadi" card in ProfileScreen (outbound only)
- [x] Tests (13): existing-code reuse, lazy mint, collision fallback, valid attribution, IP hashed not raw, self-referral rejected, unknown code ignored, soft-deleted referrer ignored, duplicate referred user swallowed, pending→qualified transition, no-op when nothing pending, never throws, summary shape/masking
- [ ] `referral_link_shared` / `referral_dashboard_viewed` analytics — deferred (needs an event emitter to stay off the module cycle); `POST /referrals/share` is a validated no-op stub so the client contract is already stable
- [ ] Run `prisma generate` + `prisma migrate deploy` (see Status)

### 2.11 Task checklist — 1b (rewards & recognition)

- [x] Prisma: `ReferralMilestone` model + migration (`20260902130000_add_referral_milestones`), `@@unique([userId, kind, tier])`
- [x] `REFERRAL_TIERS` ladder in `packages/shared` (authoritative resolution in the API)
- [x] `syncReferrerMilestones` — tops up referrer tier badges on every `qualified` transition (`skipDuplicates`)
- [x] `attributeOnRegister` mints the friend's `joined_via_friend` welcome badge
- [x] `markQualifiedIfPending` refactored to `findUnique`→`update` (needs `referrerUserId`), still idempotent + non-throwing
- [x] `getSummary` extended: `tier`, `nextTier` (+ `remaining`), `unseen` badges
- [x] Endpoints: `GET /referrals/link`, `POST /referrals/milestones/ack`, `GET/POST /referrals/received[/ack]`
- [x] Shared types: `ReferralTier`, `ReferralMilestoneNotice`, `ReferralReceivedStatus`, `ReferralNudgeContext`, extended `ReferralSummary`
- [x] Web `/invite`: tier + progress bar + full ladder + one-time badge celebration
- [x] Web `<ShareNudge>` component (decision/cook/plan copy) wired into `DecideFlow` after results (members only)
- [x] Web `<FriendWelcomeBanner>` on `HomeHub` (self-fetch, one-time, acks server-side)
- [x] Tests (now 76 total): milestone top-up on cross, friend welcome badge minted, `markQualifiedIfPending` no-ops on missing/already-qualified, tier/next-tier/`unseen` in summary, received status
- [ ] `<ShareNudge context="cook">` in Cook Today save flow and `context="plan">` on the accepted-plan view — component is ready, just not mounted
- [ ] Real paid reward (Plus days / ad-free) — new `ReferralMilestone.kind` + grant in `markQualifiedIfPending` when entitlements exist; `Referral.status = rewarded` starts being used

## 3. Phase 2+ (not now)

- **Referral milestones beyond the 4 tiers / a managed Ambassador program**
  (strategy §10) — outreach to creators, communities, churches, unis. The
  `referrer_tier` badge at 10 is the on-ramp; the program itself is manual.
- **Streaks / challenges** (strategy §6–7), **"Decide for Us" group decisions**
  (§8) — retention features, not referral plumbing.
- **Click-through `invited` count** — needs a `ReferralClick` row or a
  code-keyed counter; dropped from Phase 1.
- **Mobile inbound attribution** — `scheme` in `app.json` + App Links / Universal
  Links + deferred-deep-link handling for the install case.
- **Anti-abuse hardening** — disposable-email rejection, device fingerprinting,
  per-referrer reward rate-limit. (Phase 1 has: self-referral block, one
  `Referral` per referred user by DB constraint, `qualified` requires a real
  event, hashed signup IP for manual review.)
- Admin console read-only referrals view — the tables already fit the existing
  admin module pattern.

---

## 4. Open decisions — all resolved (kept for the record)

1. **Interim shared-link target** → `/?ref=CODE` (§Status table row 1).
2. **Analytics ↔ referrals coupling** → `AnalyticsModule` imports `ReferralsModule`;
   `ReferralsService` is Prisma-only; share/dashboard telemetry deferred to an
   event emitter (§Status table row 2).
3. **`invited` count** → dropped; joined/qualified only (§Status table row 3).
4. **The reward** → recognition (tier badges + friend welcome badge), not a paid
   perk; `rewarded` status reserved for real perks later (§Status "Reward model").
5. **Qualifying-event set** → the 5-event allowlist in
   `referrals/qualifying-events.ts` is confirmed.
