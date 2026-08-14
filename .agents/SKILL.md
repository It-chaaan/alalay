# Alalay Development Skill

Use this for feature work, bug fixes, refactors, Supabase changes, analytics, AI/OCR work, and UI polish.

## Workflow

1. Identify the scope first: web (`frontend/`), mobile (`mobile/`), backend (`backend/`), or shared infrastructure (`supabase/`, shared API/contracts).
2. Inspect the relevant client screen, hook, backend route/service, and migration.
3. Check `git status` and preserve unrelated changes.
4. For web work, reuse the existing `frontend/` Supabase client, API client, hooks, Tailwind/CSS, and layout components.
5. For mobile work, inspect and reuse the patterns already established in `mobile/` (Expo Router, StyleSheet palettes, Expo/native packages, and SecureStore auth). Do not copy Vite, browser APIs, Tailwind/CSS, localStorage, browser OCR, or web routing patterns blindly into React Native.
6. For backend/shared work, consider both clients and preserve the single backend, Supabase project, schema, RLS policy, and API contract.
7. Cross-check env names against the relevant `.env.example` files and `backend/src/config/env.ts`.
8. Run relevant client/backend builds and update the relevant project docs when architecture, auth, schema, API, analytics, AI, OCR, theme behavior, or client structure changes.

## Auth rules

- Supabase Auth supports email/password and Google OAuth; OAuth uses `/auth/callback` and the current client relies on the default implicit flow.
- Do not manually create Google users. Supabase creates/matches the auth user and the profile trigger creates `public.users`.
- Google-only accounts use the Settings “Set a password” state; detect email identities/providers or `user_metadata.password_set`, update password plus the marker, and refresh session state.
- MFA is authenticator-app TOTP, not email/SMS. Use verified `totp` factors and `mfa.challengeAndVerify`.
- Trust-device is not complete: the checkbox has no durable token, hashing, revocation, or backend enforcement.
- Guide Google-only login failures to Google sign-in or Settings → Set a password.
- Web uses the existing browser Supabase flow; mobile uses its native client and PKCE/deep-link flow. Verify the client-specific implementation before changing OAuth.

## Theme/accessibility rules

- For web, respect Light/Dark/System via `AppPreferencesContext` and the root `dark` class. For mobile, use `AppThemeProvider`/`useAppTheme` and semantic tokens; appearance preference is device-local and resolves `system` from the live OS scheme.
- Prefer existing web Tailwind surface/text classes or mobile StyleSheet palette tokens, with both-mode handling where that client supports it. Never add light-only cards, banners, inputs, alerts, toasts, badges, or empty states to a client that supports dark mode.
- Use high-contrast shared shell title/subtitle styles and preserve visible focus states and practical WCAG AA contrast.
- Report charts need keyboard-reachable value tooltips, and budget indicators must pair color with labels or values.

Budget editing is month-scoped: use the selected `YYYY-MM` when reading or saving the shared budget plan, and keep over-budget states legible with both color and text.

Wallet/account links are account-scoped: income records require `wallet_id`, outgoing records may set it, and wallet balances must remain derived from linked transaction rows. Validate wallet ownership server-side and preserve the default Cash wallet.

Loan principal is balance-sheet data: a lent balance is a receivable and a borrowed balance is a liability. Create and repay loans through atomic authenticated RPCs, keep principal out of income/expense reports, and record only actual interest in those ledgers.

## Data rules

- Keep business calculations in backend services, especially analytics/reporting.
- Use `Asia/Manila` date-only boundaries for finance summaries unless product requirements change.
- Report totals and breakdowns must use the same spending dataset; chart values must not be visually rescaled in a way that contradicts their labels.
- Return dynamic chart current markers; do not hardcode month labels.
- Distinguish loading, successful-empty, and error states; never turn failed queries into `₱0` or blank content.
- Use migrations for schema/index/trigger changes and preserve RLS/backend auth.
- Per-user mobile presentation preferences must use shared authenticated API contracts and RLS-backed storage; do not persist account-scoped choices only in an unscoped local cache.
- Expense reads must use inclusive Manila-local date ranges and the shared mobile finance normalizer/mutation notification so Expenses and Home Recent Transactions observe the same persisted record after save.
- Upcoming status is presentation derived from paid state and Manila-local due dates. Preserve the payment model; reuse `StatusBadge` variants and semantic theme tokens instead of introducing screen-specific status pills.
- Bill filters are product controls, while card statuses are informational. Keep due-today/due-soon inclusion in the existing Upcoming filter when simplifying their visual treatment.
- Loan/debt writes must use the shared authenticated RPC/API contract. Keep principal separate from income/expense rows; only actual interest and explicit receivable write-offs enter reporting ledgers.

## Profile data flow

- Use Supabase Auth for user identity/email and `public.users` for application profile fields.
- Use the shared current-user API (`/api/users/me`) rather than introducing client-specific profile endpoints.
- Profile UI must distinguish loading, missing profile rows, and load errors; missing rows may be lazily initialized only for the authenticated user.

## AI/OCR rules

- Gemini chat is backend-only through `/api/ai/status`, `/api/ai/chat`, and `/api/ai/chat/stream`; never expose keys or move prompts/data calls to the client.
- Conversational financial writes use only the backend's controlled Gemini tool surface (`create_expense`, `create_income`, `create_transfer`, `create_bill`, `create_subscription`). Resolve wallets by authenticated-user-owned names server-side, invoke existing domain services, and require structured success results before confirmation. Preserve request IDs for idempotency; never retry an uncertain financial write blindly.
- The dashboard AI card remains a placeholder and must not be given fake text. Define data, prompt contract, endpoint, refresh, caching, and error behavior before wiring it.
- Receipt OCR is server-side: mobile captures/selects a still image and sends authenticated multipart data to `/api/ocr/receipt`; Node runs `tesseract.js`, parses a review-only candidate, and never creates an expense. Receipt images are transient in memory and must not be logged or stored unless a future approved retention feature adds private, user-scoped storage.

## Profile/avatar rules

- Scope local profile storage by Supabase user ID (`alalay-profile:<userId>`).
- Use Google provider metadata when available; otherwise use neutral initials. Never reuse a global cached photo.
- Keep avatar uniqueness/repair logic in migrations and never use service-role credentials in the browser.

## Validation

- Run the relevant builds.
- Test dates near timezone/month boundaries and assert current markers change.
- Verify email/password, Google callback, Google-only password setup, and TOTP paths separately.
- Report unavailable browser/provider/production checks honestly and mark incomplete features as partial or needing verification.

## Applying the engineering quality standards

Follow the mandatory requirements in `AGENTS.md` during implementation. Use this
section as the practical workflow rather than treating formatting as the whole
quality review.

### While changing code

1. Read the whole target module and its immediate dependencies before editing.
   Identify whether the concern is UI coordination, domain logic, persistence,
   external integration, or a reusable presentation component.
2. Keep non-trivial declarations vertical. Break long imports, props, function
   signatures, payloads, callbacks, JSX props, and object literals at sensible
   semantic boundaries. Aim for 100 columns and do not exceed 120 routinely.
3. For a large component, derive data and handlers above the return, then extract
   a named domain concept only when it has a coherent responsibility. Do not
   split JSX merely to meet a line count.
4. For a large `StyleSheet`, use a readable `createStyles` factory, choose a
   non-shadowing palette name, put one style property per line, and group large
   collections by UI concept. Use existing semantic theme tokens instead of
   feature-local color values where available.
5. Before creating a utility/service/repository, search the existing services,
   finance/date utilities, category registry, API clients, and components.
   Reuse the established boundary; create a new one only for a real domain or
   infrastructure capability.

### Safe refactoring patterns

- Replace a long prop signature with a named props interface and vertically
  destructure it in the component.
- Replace a long related parameter list with a typed input object at service and
  API boundaries.
- Move financial calculations, Manila date-only rules, category resolution, and
  API/Supabase access out of rendering code into the established service or
  domain utility. Do not duplicate a formula for a screen.
- Prefer an interface plus composable adapter for a replaceable external system
  (for example an OCR engine). Keep simple pure transformations as functions;
  do not introduce class hierarchies or generic managers.
- Replace nested ternaries with a named selector, status map, or guard clauses.
  Give business thresholds and repeated statuses canonical names when the
  repository does not already provide them.
- Document non-obvious financial, security, date, and platform decisions with a
  short why-comment. Delete stale commented-out code instead of preserving it.

### Touched-area review

Apply the Boy Scout Rule only within scope: leave the code you touch at least as
clear as it was. Safe nearby cleanup includes a dead import, an unreadable
object, a misleading local name, or a duplicated local constant. Do not change
financial behavior, data contracts, navigation, RLS, or persistence during a
readability refactor. Use focused tests to show that behavior remains intact.

### Quality checks

Before handoff, inspect the diff and run the available checks for each affected
client: formatter when one is configured, `npm run lint` for mobile, `npx tsc
--noEmit` or the package build/typecheck, focused tests, and `git diff --check`.
Run the repository-owned Prettier commands (`npm run format` or `npm run
format:check`) from the root as appropriate; use the formatter deliberately and
avoid mass-formatting unrelated files during focused work. Record existing
warnings separately from new failures.
