# FoodPadi Mobile (Phase 1 — Foundation)

Expo/React Native/TypeScript app. Implements: auth (email/password), the
disclaimer acknowledgement screen (§12), the food/lifestyle goal screen
(§10), and the Home screen shell with the four primary actions (§4). Eat
Now/Cook Today/Plan Ahead/Scan are stubs — logic lands in Phases 2-6.

## Setup

1. From the repo root: `npm install`.
2. Start the API first (`npm run api:dev`) — the app points at
   `http://localhost:4310` by default (see `app.json` → `expo.extra.apiBaseUrl`).
   For a physical device, change this to your machine's LAN IP.
3. `npm run mobile:start` (or `npm run start --workspace=@foodpadi/mobile`),
   then open in Expo Go or a simulator.

## Structure

```
App.tsx                     — providers + root navigator
src/auth/AuthContext.tsx    — session state, backed by expo-secure-store tokens
src/api/                    — typed fetch client + secure token storage
src/screens/                — AuthScreen, DisclaimerScreen, GoalScreen, HomeScreen
src/navigation/              — state-driven onboarding switch (see file comment for why
                               it's not a stack navigator yet)
```

## Security note

Access/refresh tokens are stored via `expo-secure-store` (OS keychain/keystore),
not `AsyncStorage`, per [docs/SECURITY_MODEL.md](../../docs/SECURITY_MODEL.md).
