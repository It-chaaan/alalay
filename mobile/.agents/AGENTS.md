# Alalay Mobile — Agent Reference

## Project overview

Alalay Mobile is the React Native (Expo) client for the Alalay personal finance app. It shares the existing Supabase project and Express backend used by the web app (`alalay-web`) — this is a new client only, not a new backend. Feature scope mirrors the web app: authentication, household-aware finance tracking, bills, subscriptions, expenses, income, savings goals, budget planning, reports, OCR-assisted entry, and an AI assistant backed by Google Gemini.

This document is the implementation-derived reference for AI-assisted changes to the mobile app. It must stay aligned with the mobile codebase. It intentionally mirrors the structure of the web app's `AGENTS.md` so the two stay easy to cross-reference, but the two documents describe two different clients — do not assume a rule from one automatically applies to the other without checking the mobile-specific notes below.

## Repository structure

```text
mobile/     React Native (Expo) application — this project
backend/    Express + TypeScript API server (shared with web, not duplicated here)
supabase/   SQL migrations, config, generated types (shared with web, source of truth lives in the web repo)
.agents/    AI-facing project instructions (mobile-specific, this file + SKILL.md)
```

If the mobile app lives in its own repository separate from the web app, treat `backend/` and `supabase/` above as references to the web repo's copies, not local directories — do not duplicate backend code or migrations into the mobile repo. Confirm the actual repo layout before assuming either way.

## Current architecture

### Mobile client

- Framework: React Native via Expo (managed workflow)
- Language: TypeScript
- Metro uses Expo defaults with strict package-export resolution disabled so dependencies can fall back to published `main`/`module` entries when an export map is incomplete.
- Navigation: Expo Router (file-based routing) — confirm this is the actual navigation library in use before assuming; if the project instead uses React Navigation directly, follow its existing route structure rather than introducing Expo Router mid-project.
- Styling: prefer a single consistent approach (e.g. NativeWind if Tailwind-style utility classes are wanted for parity with the web app's mental model, or StyleSheet-based design tokens) — do not mix multiple styling approaches within the app. Confirm which is already established before adding new screens.
- State model:
  - React local state for screen-level concerns
  - Auth state through an `AuthContext` equivalent to the web app's, adapted for mobile session storage (see Authentication below)
  - Data fetching through shared hooks mirroring the web app's pattern (`useApiQuery`, `useApiMutation`) — port these rather than reinventing a new data-fetching pattern, so backend contracts and error handling stay consistent between web and mobile.
- API access through `src/services/api.ts`, which attaches the active Supabase access token to the shared backend. It currently supports the Home chat-head's dashboard insight and AI chat; port shared query/mutation hooks as fuller mobile feature screens are added.

### Backend

- No separate mobile backend. The mobile app calls the same Express API used by web.
- Do not duplicate business logic, validation, or analytics calculations into the mobile client. Per the web app's `AGENTS.md`, financial calculations stay centralized in backend services — this applies equally to mobile. The mobile client renders server results and performs only UI-level formatting.
- If a mobile-specific endpoint or response shape is genuinely needed (e.g. a leaner payload for a mobile list view), add it to the shared backend rather than computing it client-side in the mobile app.

### Database

- Same Supabase Postgres project as web. No mobile-specific tables unless a genuine mobile-only need arises (e.g. push notification device tokens) — if that happens, add a migration under the shared `supabase/migrations/` and document it in both this file and the web app's `AGENTS.md`.
- Do not generate a second, divergent copy of Supabase types for mobile — reuse or regenerate from the same schema source used by web.

### Authentication

- Provider: Supabase Auth (same project as web).
- Session storage: use `expo-secure-store` (or the current project's established secure storage library) for persisting the Supabase session on-device, not `AsyncStorage` alone (which is not encrypted) and never a plain JS variable that resets on app restart. Expo web preview uses guarded browser `localStorage` only because SecureStore is native-only; its XSS exposure makes it unsuitable as the policy for a production web app.
- Current implementation: `mobile/src/services/supabase.ts` creates the platform-aware Supabase client with SecureStore persistence on iOS/Android and guarded `localStorage` persistence on Expo web, while `mobile/app/auth.tsx` provides email/password sign-in, sign-up, and Google OAuth using the PKCE/deep-link flow.
- `mobile/app/_layout.tsx` restores the persisted session before rendering the navigation stack, shows a loading state during the check, and redirects authenticated users to Home without a landing/sign-in flash.
- `mobile/app/_layout.tsx` restores the persisted session before rendering the navigation stack, shows a loading state during the check, and redirects authenticated users to Home without a landing/sign-in flash.
- Expo SDK 54 pins `expo-secure-store` to `~15.0.8`; after changing Expo/native dependencies, update Expo Go or rebuild the development client because Metro reloads cannot update the native SecureStore module.
- SecureStore-backed auth session persistence must be tested in a development build (`npx expo run:ios`, `npx expo run:android`, or EAS development build). Expo Go may bundle an older native SecureStore surface; the app degrades to signed-out/non-persistent behavior there rather than crashing, but it is not a valid persistence test.
- OAuth (Google): mobile OAuth cannot reuse the web app's `/auth/callback` browser redirect flow as-is. Use Expo's `expo-auth-session` (or Supabase's documented React Native OAuth pattern) with a proper deep link scheme registered for the app. Confirm the redirect URI is registered in both the Supabase Auth settings and the Expo app config before assuming this works out of the box.
- MFA: same TOTP-based approach as web (`mfa.challengeAndVerify` against verified `totp` factors) — do not implement SMS/email MFA on mobile if the web app deliberately avoids it; keep this consistent across clients unless there's a specific product reason to diverge.
- Google-only accounts / "Set a password" flow: port the same detection logic (email identities/providers, `user_metadata.password_set`) from web; the mobile Settings screen needs an equivalent "Set a password" state.
- Trust-device: the equivalent concept doesn't yet have durable backend enforcement in the web app per its own `AGENTS.md`. Do not build a mobile-side trust-device feature that implies stronger guarantees than the backend can currently enforce.

### AI

Ask Alalay sends bounded history and a stable per-submission request ID to the authenticated backend chat endpoint. Financial creation actions remain server-side controlled tool calls; the backend resolves wallets against the authenticated user, reuses existing domain services, and returns a mutation flag for mobile financial refresh notifications.

- Provider: Google Gemini Flash — same backend routes as web (`/api/ai/status`, `/api/ai/chat`, `/api/ai/chat/stream`).
- Never call Gemini directly from the mobile client and never embed API keys in the mobile app bundle — same rule as web, and it applies even more strictly on mobile since app bundles are easier to decompile/inspect than a web app's network traffic.
- Assistant responses are rendered as markdown on web; confirm/port an equivalent React Native markdown renderer for mobile (e.g. `react-native-markdown-display`) rather than rendering raw markdown text.

### OCR

- The web app's OCR runs entirely client-side using `tesseract.js` in the browser. **This does not port directly to React Native** — `tesseract.js` is a browser/WASM-based library and is not a drop-in solution for a native mobile runtime.
- Before implementing mobile OCR, decide and document one of:
  - An Expo/React Native-compatible on-device OCR library (e.g. an ML Kit-based wrapper), or
  - Sending captured images to the backend for server-side OCR processing (which would be a new backend capability — check the web app's `AGENTS.md`, which notes current backend OCR routes are capability/demo endpoints only, not a real extraction pipeline).
- Do not silently reuse or assume `tesseract.js` works on mobile without validating this first — treat OCR as a genuinely separate implementation task, not a straightforward port.

## Mobile navigation map

The authenticated Home tab is implemented at `app/(tabs)/index.tsx` with shared finance data, one fixed monthly overview card, compact finance shortcuts, quick-add/OCR affordances, a draggable Alalay chat-head, and a floating tab bar ordered Home, Bills, Add, Budget, Reports. Expo Router's default tab chrome is hidden so it is not rendered underneath the custom bar. Budget (`app/(tabs)/budget.tsx`) reads the shared budget summary API and renders category limits/progress; Reports (`app/(tabs)/reports.tsx`) reads the shared `/api/reports/summary` payload and condenses period-aware KPIs, trends, distribution, and Budget/Savings links into one scrollable screen. Settings (`app/(tabs)/settings.tsx`) is a minimal destination ready for future preferences. The Home overview totals come from the shared dashboard summary, including spending without double-counting paid bills or subscription expense rows. The chat-head fetches the authenticated dashboard insight and uses the shared backend AI chat endpoint.

Mirror the web app's route list, adapted to mobile screens/tabs rather than URL paths. Suggested mapping (adjust to match whatever navigation library and structure the project actually uses):

- Auth stack: Login, Register, (no working "forgot password" yet, matching web)
- Main tab/stack: Dashboard (home), Bills, Subscriptions, Expenses, Income, Goals, Budget, Reports, AI Assistant, OCR Scanner, Settings
- Settings sub-screens: Profile, Preferences, Notifications, Security

Confirm the actual current navigation structure in the codebase before assuming this mapping is already implemented — this is a target structure to build toward, not a description of existing code.

The Home overview's Net Savings is the same current-month calculation as Reports: income minus expenses and paid bills. It includes a month-over-month trend only when a meaningful previous-month comparison is available.

## Current feature map

Same feature scope as the web app's feature map (Auth, Dashboard, Bills, Expenses, Income, Subscriptions, Savings goals, Budget, Reports, AI assistant, OCR scanner, Settings) — refer to the web app's `AGENTS.md` for the authoritative description of what each feature does. This document does not duplicate that list; it only calls out where the mobile implementation must diverge (auth session storage, OAuth flow, OCR, navigation).

## Data flow

Expense and bill payment mutations use the shared finance service. Bill payment sends the selected `wallet_id` and Manila-local `payment_date` through the atomic backend RPC, then publishes the shared financial mutation notification so Home, Expenses, Bills, and other focused finance screens refresh authoritative data.

1. Mobile screen calls the shared `useApiQuery`/`useApiMutation` hooks (ported from web).
2. Requests go through the shared API client module, pointed at the backend's base URL (see Environment variables).
3. Backend auth middleware resolves the current user from the Supabase token, same as web — the mobile client must attach the token the same way web does (`Authorization: Bearer <token>`), since the backend doesn't currently have a separate mobile-specific auth path.
4. Route handlers validate payloads and call service-layer logic — unchanged from web, shared code.
5. Services read/write Supabase tables and compute analytics — unchanged from web, shared code.
6. Mobile screen updates local state from normalized API responses, same pattern as web.

## Environment variables

### Mobile

- API base URL: Expo requires the `EXPO_PUBLIC_` prefix for any env variable exposed to client code (e.g. `EXPO_PUBLIC_API_URL`), analogous to web's `VITE_API_URL`. Do not reuse the `VITE_` prefix — it has no special meaning in Expo and won't be exposed correctly.
- Supabase anon key and URL: also need `EXPO_PUBLIC_` prefixed equivalents (e.g. `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`) — same anon key is fine to reuse from the web app's Supabase project since it's meant to be public, but it needs to be present in the mobile app's own env config, not assumed to be inherited from the web repo.
- Any secret values (none should exist client-side in a correctly configured app) must never use the `EXPO_PUBLIC_` prefix, since that prefix makes a value part of the bundled client code.
- For EAS builds, use EAS Secrets for any build-time values that shouldn't be committed to `.env` files in the repo.

### Backend

No changes from the web app's backend environment variables — the mobile app doesn't introduce new backend env requirements unless a mobile-specific backend feature (e.g. push notifications) is added.

## Coding standards

Same standards as the web app's `AGENTS.md` (explicit types at service/API boundaries, Zod validation of external input, avoid `any`), adapted for React Native conventions:

### React Native

- Reuse existing hooks (ported from web) before introducing new data-access patterns.
- Keep screen components focused on orchestration and rendering; push API interaction into shared hooks/services, same discipline as web.
- Respect platform differences (iOS vs. Android) where they matter for UX (safe areas, gesture conventions, navigation patterns) without maintaining fully divergent codepaths unless genuinely necessary.

### Components

- Reuse existing layout, card, list, and form patterns already established in the mobile app rather than introducing new one-off patterns per screen.
- Keep assistant markdown rendering visually aligned with the app's chat bubble styling.
- The landing feature carousel's presentational SVG artwork lives in `src/components/feature-slide-art.tsx`; keep its palette prop-driven when adding or revising slides.
- App UI icons use `lucide-react-native`; the only non-Lucide icon asset is the official four-color Google brand mark.

## Security rules

Same as web's `AGENTS.md`, plus mobile-specific additions:

- Never expose `SUPABASE_SERVICE_ROLE_KEY` or `GEMINI_API_KEY` to the mobile client — same rule as web, enforced by never using the `EXPO_PUBLIC_` prefix on these.
- Never bypass backend auth middleware.
- Respect RLS assumptions in every query/mutation, same as web.
- Treat financial data and any stored tokens (Gmail connections, if ported to mobile) as sensitive — store using secure, encrypted on-device storage, not plain `AsyncStorage`.
- Session tokens must be stored via secure storage (`expo-secure-store` or equivalent), not plain `AsyncStorage`, given mobile devices can be lost/stolen and app sandboxing alone isn't sufficient protection for auth tokens.

## Shared finance entry components

- `src/components/finance-form.tsx` owns the shared add-form interaction system for bills, subscriptions, expenses, income, and savings goals: keyboard-safe sheet layout, custom amount keypad, basic inline arithmetic, chip rows, payment-method chips, and the in-app calendar picker.
- `app/(tabs)/expenses.tsx` is the dedicated monthly expense overview. It reuses `fetchExpenses()` and shared bill records, merges paid bills into the spending list, and keeps Log expense on the shared form sheet.
- Amounts are entered through the custom keypad and parsed on save; text fields remain system-keyboard inputs inside `KeyboardAvoidingView` behavior. Keep new finance add flows on this component system rather than recreating form sheets per screen.
- The keypad's amount state remains a clean expression for parsing and persistence while the display adds thousands separators; `⌫` removes one character and the trash key clears the whole expression.
- The subscription API/schema currently has no category column, so subscription category chips are presentational until the shared schema is intentionally extended.
- One-time income uses a nullable `frequency`; recurring income persists the selected weekly, monthly, biweekly, or yearly value.

Budget create/edit uses the shared `/api/budget` contract and sends the selected `YYYY-MM` month; budget plans are persisted per user and month rather than through a mobile-only store.

## Known implementation issues to track

Carry over anything from the web app's "Known implementation issues" list that also affects the shared backend/database (since mobile calls the same backend), specifically:
- Budget PATCH validation weakness (shared backend issue, affects mobile too until fixed upstream).
- Any RLS/service-role issues noted in the web app's most recent security audit — these affect mobile requests equally since they hit the same backend.

Mobile-specific issues should be tracked separately in this file as they're discovered, rather than mixed into the web app's list.

### Current profile data flow

- `mobile/src/services/profile.ts` normalizes Supabase Auth identity with the RLS-scoped `GET/PATCH /api/users/me` response.
- `mobile/src/hooks/use-current-profile.ts` shares the current profile and publishes successful updates to Home, Settings, profile screens, and avatar controls.
- Email remains read-only in mobile because Supabase Auth controls it; display name and optional phone persist through `public.users`.

## Documentation synchronization rules

## Mobile MFA flow

- Supabase Auth TOTP is authoritative for factor enrollment, assurance level, challenge verification, and unenrollment.
- `mobile/src/services/mfa.ts` distinguishes an enabled factor from the current session's required AAL2 challenge.
- Native trusted-device tokens are stored in SecureStore and sent through the authenticated `/api/trusted-device` contract; explicit logout clears the local token.
- A valid restored AAL2/trusted session opens the app directly. Pending AAL2 sessions are routed to `/auth?mode=mfa` before protected tabs render.

## Goals and wallet allocations

- The mobile Savings route remains internally named `savings` for routing and API compatibility, but the user-facing feature is `Goals`.
- Goals no longer render a global Savings balance; Wallets remain the source of truth for actual money.
- New goal contributions use `POST /api/savings-goals/:id/contributions` with a wallet source. The shared backend validates wallet ownership, goal ownership, target limits, and unallocated wallet balance.
- Existing `savings_goals.current_amount` values remain preserved as legacy/unattributed progress until explicitly represented by wallet-backed contributions.

Whenever mobile architecture, navigation, auth flow, OCR approach, or environment config changes, update:

- This file (`.agents/AGENTS.md` in the mobile repo, or the equivalent path)
- `.agents/SKILL.md` (mobile)
- The mobile app's `README.md`

If a change affects shared backend/database behavior, also flag it for update in the web app's `AGENTS.md` — do not let the two documents silently diverge on shared-backend facts (e.g. schema, auth rules, AI routes).
