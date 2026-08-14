# Alalay Agent Reference

## Project overview

Alalay is a Filipino-first personal finance application with an existing React web client and an Expo/React Native mobile client in the same repository. The web client contains the implemented finance product; mobile development is the current active focus and is still a scaffold/partial implementation. Both clients use the existing backend and Supabase infrastructure; mobile does not have a separate backend or database.

This document is the implementation-derived reference for future AI-assisted changes. It must stay aligned with the codebase.

## Repository structure

```text
package.json       Root workspace metadata/scripts
frontend/   React 19 + TypeScript + Vite application
backend/    Express + TypeScript API server
mobile/     React Native + Expo mobile client (active development)
supabase/   SQL migrations, config, generated types
.agents/    AI-facing project instructions
```

`node_modules/`, `package.json`, and `package-lock.json` also exist at the repository root. Client-specific dependencies and lockfiles are under `frontend/` and `mobile/`; backend dependencies are under `backend/`.

## Current architecture

### Frontend

- Framework: React 19 with TypeScript
- Build tool: Vite
- Styling: Tailwind utility classes plus shared CSS in `frontend/src/index.css`
- Routing: manual route switching in `frontend/src/App.tsx`
- State model:
  - React local state for page concerns
  - Supabase session state is currently coordinated in `frontend/src/App.tsx`
  - Preferences through `frontend/src/context/AppPreferencesContext.tsx`
  - Data fetching through shared hooks:
    - `frontend/src/hooks/useApiQuery.ts`
    - `frontend/src/hooks/useApiMutation.ts`
- API access through `frontend/src/lib/apiClient.ts`

### Mobile

- Framework: React Native with Expo SDK 54 and TypeScript
- Navigation: Expo Router with a root stack and an authenticated shell; the default tab chrome is hidden in favor of the Home floating nav (Home, Income, Camera/OCR, Budget, Reports). Bills, subscriptions, and savings are reached from dashboard shortcuts.
- Styling: React Native `StyleSheet` and palette objects; no NativeWind/Tailwind layer
- Current routes/files: `app/index.tsx` (landing carousel), `app/auth.tsx` (sign-in/sign-up), `app/(tabs)/index.tsx` (Home), `income.tsx`, `bills.tsx`, `subscriptions.tsx`, `savings.tsx`, `ocr.tsx`, `profile.tsx`, `notifications.tsx`, `budget.tsx`, `settings.tsx`, and `app/modal.tsx`
- Shared components/hooks: `components/`, `hooks/use-color-scheme.ts`, `hooks/use-theme-color.ts`, and `constants/theme.ts`
- Native dependencies used by the current UI include Expo Image, Expo SecureStore, Expo WebBrowser, Expo Linking, React Navigation, React Native Reanimated, React Native SVG, safe-area-context, and vector icons
- Supabase client: `mobile/src/services/supabase.ts`; it uses `@supabase/supabase-js` with SecureStore-backed native session persistence, a guarded `localStorage` fallback for Expo web preview, and PKCE OAuth settings
- Theme: mobile now resolves persisted device-local `system`/`light`/`dark` appearance through `src/theme/theme.tsx`, with semantic light/dark tokens and themed navigation/status-bar surfaces.
- The mobile app has a small authenticated API helper at `mobile/src/services/api.ts` for the Home chat-head's dashboard insight and AI chat; it does not yet contain the web client's query hooks, full dashboard data screen, or a mobile AuthContext equivalent

### Shared infrastructure

- `backend/` is the shared Express API server for web and any future mobile API integration.
- `supabase/` contains the single shared Postgres schema, migrations, RLS policies, and generated types used as the source of truth.
- Do not create a mobile-specific backend, Supabase project, schema fork, or duplicate financial calculation layer.

### Category architecture

- The canonical cross-client category catalog is `mobile/src/constants/category-registry.ts`. It defines stable local keys, display labels, semantic icon keys, colors, and lightweight groups.
- Financial APIs and database fields deliberately serialize the established display label strings and validate them as bounded strings, not an enum. New canonical labels are therefore compatible without a schema migration; historical or custom values remain supported.
- Web resolves the same registry through `frontend/src/utils/categoryRegistry.ts`; mobile resolves native Lucide icons through `mobile/src/constants/categories.ts`. Unknown legacy values use a safe generic category fallback only.

### Backend

- Runtime: Node.js with Express and TypeScript
- Entry point: `backend/src/index.ts`
- Route registration: `backend/src/app.ts`
- Validation: Zod schemas in route modules and `backend/src/schemas/`
- Supabase access:
  - anon-scoped client for user-context reads/writes
  - service-role client for privileged backend operations

### Database

- Platform: Supabase Postgres
- Schema source: `supabase/migrations/`
- Generated frontend types: `frontend/src/integrations/supabase/types.ts`
- Core tables currently present:
  - `users`
  - `families`
  - `bills`
  - `expenses`
  - `income`
  - `subscriptions`
  - `savings_goals`
  - `wallets`
  - `notifications`
  - `dashboard_preferences`
  - `ai_insights`
  - `gmail_connections`
  - `bill_suggestions`
  - `budget_plans`
  - `savings_preferences`

`users.phone` is part of the schema in current migrations.

### Authentication

- Provider: Supabase Auth
- Web session source: Supabase session handling in `frontend/src/App.tsx`
- Mobile auth: `mobile/app/auth.tsx` calls Supabase Auth directly through `mobile/src/services/supabase.ts`; `mobile/app/_layout.tsx` restores the persisted session before routing into the authenticated shell
- Backend protection: auth middleware on `/api/*` routes
- Protected UI: dashboard routes gated in `frontend/src/App.tsx`
- Mobile native session persistence uses Expo SecureStore; Expo web preview uses guarded `localStorage` to retain sessions across reloads. Mobile OAuth uses a PKCE/deep-link flow through Expo WebBrowser/Linking.
- Backend CORS uses an explicit allow-list: configured browser origins plus Expo web preview on `http://localhost:8081` and `http://localhost:8082`; it does not use a wildcard origin.

### AI

- Provider: Google Gemini Flash
- Backend services:
  - `backend/src/services/ai.service.ts`
  - `backend/src/services/ai.providers.ts`
  - `backend/src/services/ai.context.service.ts`
- Routes:
  - `GET /api/ai/status`
  - `POST /api/ai/chat`
  - `POST /api/ai/chat/stream`
- Frontend integration:
  - `frontend/src/hooks/useAiAssistant.ts`
  - `frontend/src/pages/dashboard/AiAssistantPage.tsx`
- Assistant responses are rendered as markdown in the frontend.
- Ask Alalay's mobile chat contract carries multi-turn state as validated camelCase `pendingAction`; this is application state and is translated into supported provider context rather than sent as an unsupported provider field. Financial action failures are structured and technical errors are normalized before reaching chat UI.

### OCR

- OCR is implemented in the frontend, not as a backend extraction pipeline.
- Main page: `frontend/src/pages/dashboard/OcrScannerPage.tsx`
- Engine: `tesseract.js`
- Backend OCR routes currently expose capabilities/demo endpoints only.
- Mobile receipt scanning uses Expo Camera or Expo Image Picker, then uploads the selected image as authenticated multipart data to `POST /api/ocr/receipt`. Node runs `tesseract.js` and returns a review candidate; it never creates an expense. This core flow is Expo Go-compatible when `EXPO_PUBLIC_API_URL` points to a backend reachable from the device. Receipt images are held only in request memory for OCR and are not persisted to Supabase Storage.

## Frontend routing

Routes are manually mapped in `frontend/src/App.tsx`.

- `/`
- `/login`
- `/register`
- `/app`
- `/app/bills`
- `/app/subscriptions`
- `/app/expenses`
- `/app/income`
- `/app/savings-goals`
- `/app/budget`
- `/app/reports`
- `/app/ai-assistant`
- `/app/ocr-scanner`
- `/app/settings`
- `/app/settings/plan` redirects to settings

The web app includes `/forgot-password` and `/reset-password` routes; mobile does not currently implement a password-reset screen.

Mobile uses Expo Router files rather than these web paths. The currently implemented mobile route set is the landing screen, auth screen, modal, and the `Home`/`Explore` tab scaffold; it does not yet mirror the web feature route inventory.

## Current feature map

### Auth

- Email/password login and registration
- Session-aware app shell
- User profile loading from backend/Supabase

### Dashboard

- Summary cards and finance overview
- Recent activity and high-level metrics
- Mobile Home keeps its balance summary and prioritized quick actions in one financial-overview surface. `mobile/src/utils/quick-action-overflow.ts` derives visible and overflow actions from measured row width, reserving a `More` slot only when actions are hidden; routes remain defined once in the Home action configuration.
- Mobile Home uses the shared dashboard summary API for its overview and the authenticated `GET /api/income/next-payday` endpoint for the dynamic payday indicator. The payday endpoint derives the next occurrence from recurring income through `income-recurrence.service.ts`; it prefers salary/payroll-labelled recurring income and otherwise uses the earliest next recurring source with a stable ID tie-breaker.
- Home Upcoming uses the shared `derivedStatus` presentation rule: paid overrides date urgency, followed by overdue, due today, due soon (within three Manila calendar days), and upcoming. `StatusBadge` provides a compact semantic dot/check treatment for that grouped list while retaining its fuller badge variant elsewhere.
- Bills reuse the same compact status treatment and keep `Due today`/`Due soon` grouped under the existing Upcoming filter; filter semantics remain separate from presentation.
- Loans & Debt is a Wallets drill-down, not a bottom-navigation tab. Its shared flow supports direction-first creation, optional due dates, fixed/simple expected interest, atomic split repayments, active/history grouping, payment detail history, and receivable write-offs recorded as loss expenses.

### Bills

- CRUD flows
- Status tracking
- Due-date oriented listing and summary

### Expenses

- Expense creation and listing
- Category and payment method support

### Income

- Income tracking and aggregation

### Subscriptions

- Recurring subscription tracking
- Active subscriptions require an explicit payment wallet; legacy wallet-less rows remain readable and must be assigned a wallet before reactivation/editing.
- The backend notification scheduler sends three-day renewal reminders and cumulative per-wallet funding warnings without debiting wallets; actual renewal expenses are generated by the shared subscription billing service.

### Savings goals

- User-facing Goals feature with manual wallet-backed contributions and optional monthly Budget allocations. Monthly allocations are planning data only; they do not create Expenses, change Income, or debit Wallet balances.

### Wallets

- Philippine-focused wallet/account presets with a per-user default Cash wallet
- Wallet cards use the persisted `institution_type` (`cash`, `bank`, `digital_bank`, `e_wallet`, or `other`) as their concise account metadata. There is currently no persisted debit/credit account-type field, so clients must not infer or display one from an institution name.
- Income requires a destination wallet; expenses, bills, and subscriptions may optionally reference a source wallet
- Wallet balances are recomputed from linked income, expenses, and paid bills by database triggers and exposed through the authenticated wallet API
- New wallet opening balances are recorded as `wallet_adjustments` ledger rows. Creation prefers the atomic `create_wallet_with_opening_balance` RPC and has a guarded rollback fallback during PostgREST schema-cache rollout gaps.
- Wallet-to-wallet transfers use the atomic `create_wallet_transfer` RPC. Transfer principal moves only between owned wallets and is excluded from income/spending; an optional stored fee creates a linked `Bank Fees` expense. Actual interest credits are explicit `income.type = interest` rows, while wallet interest rates are informational metadata only.
- Loans and personal debt are stored in `loans` with `loan_payments`. `lent` is a receivable and `borrowed` is a liability; loan principal is included in wallet recomputation but never in income/expense reporting. `create_loan`, `record_loan_payment`, and `write_off_loan` are authenticated atomic RPCs; only actual loan interest creates an `income` or `expenses` ledger row.

### Budget

- Budget plan persistence via `budget_plans`
- Monthly totals and budget comparisons

### Reports

- Analytical summaries and trends
- Mobile Reports exposes exactly `this_month`, `last_month`, and `one_year`. `one_year` is a rolling twelve complete calendar-month range including the current month; range aggregation remains in `analytics.service.ts`.
- Backed by backend analytics services
- Daily spending includes zero-activity dates for the selected range, and category totals must reconcile with total expenses.
- Sticky report-section links, budget filters, status timelines, and chart tooltips keep long reports navigable and interpretable.

### AI assistant

- Real backend chat integration with Gemini
- Context builder based on user financial data
- Streaming route exists
- Local chat history persistence exists in the frontend

### OCR scanner

- Browser-side OCR flow for captured or uploaded images

### Settings

- Profile editing
- App preferences
- Some settings are backend-backed, others are local-only

### Mobile implementation status

- Landing/onboarding screen with a four-slide SVG feature carousel
- Email/password sign-in and sign-up UI
- Google OAuth UI using native PKCE/deep-link handling
- Expo Router authenticated shell with a custom Home floating nav ordered Home, Income, Camera/OCR, Budget, Reports; Home includes real authenticated finance loading, profile shortcuts, and a draggable AI chat-head interaction
- Mobile Expenses, Bills/Subscriptions, Income, Savings, Budget, Reports, profile/notifications/settings, and OCR entry destinations are implemented with shared authenticated API contracts; the Home overview carousel persists per-user card selections through the shared dashboard preferences API; OCR capture itself remains platform-dependent

## Data flow

### Web flow

1. Frontend route/page calls `useApiQuery` or `useApiMutation`.
2. Requests go through `frontend/src/lib/apiClient.ts`.
3. Backend auth middleware resolves the current user from Supabase tokens.
4. Route handlers validate payloads and call service-layer logic.
5. Services read/write Supabase tables and compute analytics where needed.
6. Frontend updates local page state from normalized API responses.

### Mobile flow

The current mobile implementation calls Supabase Auth directly for its auth screens and persists sessions with SecureStore. `mobile/src/services/api.ts` attaches the current access token for the Home chat-head's dashboard insight and AI chat calls; full query/mutation hooks are not yet present. Future mobile feature screens should reuse the shared authenticated backend/API contracts rather than duplicate business logic.

Financial transaction reads use inclusive `YYYY-MM-DD` ranges with `Asia/Manila` date-only semantics. Mobile Home and Expenses share the finance service's expense normalization and mutation notification so successful expense writes refresh mounted consumers; Home refocus and financial mutations also refresh payday data. The payday card is presentational and never creates an income transaction.

## Financial logic ownership

Financial calculations should stay centralized in backend services unless a calculation is purely presentational.

Primary backend logic currently lives in services such as:

- `backend/src/services/analytics.service.ts`
- budget-related services/routes
- report aggregation paths

Frontend should render server results and only perform UI-level formatting or trivial derived display values.

## Environment variables

### Frontend

- `VITE_API_URL` is expected by the app

### Mobile

- `EXPO_PUBLIC_API_URL` is defined in the mobile environment template for future/shared API access
- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`

The current mobile Supabase auth client reads the two Supabase variables. Mobile Ask Alalay calls the authenticated `POST /api/ai/chat` endpoint with bounded history and a per-message `request_id`. The backend exposes only controlled `create_expense`, `create_income`, `create_transfer`, `create_bill`, and `create_subscription` actions, reusing existing validated domain services and authenticated wallet resolution. Successful AI mutations return `financialMutation` so mobile finance consumers can refresh through the existing mutation notification.

`frontend/.env.example` is currently incomplete and should include this.

### Backend

- `PORT`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `GEMINI_API_KEY`
- `HTTPS_ENABLED`
- `HTTPS_CERT_PATH`
- `HTTPS_KEY_PATH`

`backend/.env.example` is currently missing the HTTPS path variables used by the server.

## Database and RLS rules

- RLS is enabled on current application tables.
- Do not bypass RLS from the frontend.
- Use backend service-role access only where server-side privileged behavior is required.
- Schema changes must be introduced through migrations under `supabase/migrations/`.
- Keep generated types in sync after schema changes.

## Coding standards

### TypeScript

- Prefer explicit types at service and API boundaries.
- Validate external input with Zod.
- Avoid `any` in new code.

### React

- Reuse existing hooks before introducing new data-access patterns.
- Keep page components focused on orchestration and rendering.
- Push API interaction into shared hooks or services.

### Components

- Reuse existing layout, card, dialog, and form patterns.
- Keep assistant markdown styling aligned with current chat bubble styles.

### Services and utilities

- Reuse existing API client and backend services.
- Do not duplicate formatting, analytics, or Supabase access logic.

### Naming

- Match existing feature-oriented naming and folder layout.
- Prefer descriptive domain names over generic helpers.

## Security rules

- Never expose `SUPABASE_SERVICE_ROLE_KEY` or `GEMINI_API_KEY` to the frontend.
- Never bypass auth middleware on protected API routes.
- Respect current RLS assumptions in every new query or mutation.
- Treat `gmail_connections` tokens and user financial data as sensitive.
- Mobile native auth sessions must use SecureStore or another secure on-device mechanism; do not use plain AsyncStorage for session tokens. Expo web preview may use guarded `localStorage`, but it is less secure and should not define the production web app's storage policy.

## Shared mobile finance forms

Mobile bill, subscription, expense, income, and savings-goal creation now share a Tarsi-style form component system in `mobile/src/components/finance-form.tsx`, including a custom arithmetic keypad, chip rows, and a keyboard-safe calendar/date flow.
One-time income entries now persist a nullable `frequency`; recurring income keeps the selected weekly, monthly, biweekly, or yearly value.
The shared keypad keeps raw amount expressions unformatted for parsing/saving, displays thousands separators, uses `⌫` for single-character deletion, and uses a dedicated trash key for clear-all.

Budget plans are stored per user and `YYYY-MM` month in the shared `budget_plans` table; both web and mobile budget editors must send the selected month.

## Known implementation issues

- `supabase/config.toml` references `seed.sql`, but the file is missing.
- `backend/src/routes/resource.routes.ts` contains stale schema mapping for `bills`.
- `backend/src/routes/health.ts` appears unused.
- `frontend/src/pages/dashboard/AppPlaceholderPage.tsx` appears unused.
- Budget PATCH validation is weaker than other routes.
- Several soft-delete triggers still point at `soft_delete_bills()` for non-bill tables.
- Some user settings and AI chat history are stored in `localStorage`.
- Hardcoded colors remain in parts of the frontend instead of centralized tokens.
- Mobile feature coverage is currently partial and should not be documented as matching the web feature set until those screens and integrations exist.

## Documentation synchronization rules

Whenever architecture, schema, APIs, AI flows, OCR behavior, financial logic, or client structure changes, update the relevant documentation:

- `.agents/AGENTS.md`
- `.agents/SKILL.md`
- `README.md`
- `mobile/.agents/AGENTS.md` and `mobile/.agents/SKILL.md` for mobile-specific architecture or workflow changes

Do not leave implementation changes undocumented.

## Profile architecture

- Supabase Auth is authoritative for the authenticated user ID and email.
- `public.users` is the application profile source for display name, phone, preferences, and app profile avatar metadata.
- The shared current-user endpoint is `GET/PATCH /api/users/me`; ownership is derived from the bearer-token session and protected by RLS.
- Mobile profile consumers use `mobile/src/services/profile.ts` and `mobile/src/hooks/use-current-profile.ts` so Home, Settings, and profile screens share normalized data and updates.

## Mandatory engineering quality standards

These standards apply to all new and modified code in `frontend/`, `mobile/`,
`backend/`, `supabase/`, tests, and configuration. They supplement the
architecture rules above; they do not authorize a mechanical repository-wide
rewrite.

### Readability and formatting

- Prefer lines of 100 characters or fewer. A line may reach 120 characters only
  when splitting it would make the surrounding code less readable. Do not add
  routine application code as horizontal one-liners.
- Use multiline formatting for non-trivial functions, imports, JSX props,
  payloads, options, fixtures, and `StyleSheet`/configuration objects. Put each
  property of a complex object on its own line.
- Keep short, self-evident values inline when that is genuinely clearer.
- Use named prop types/interfaces for public or non-trivial component contracts.
  Prefer an input object when a function accepts several related arguments.
- Organize imports as React/platform, external libraries, internal modules, then
  local modules and type-only imports. Keep each group readable.
- Use the repository-owned Prettier configuration (`.prettierrc.json`) as the
  single formatting authority. It uses a 100-character print width; run
  `npm run format` deliberately and `npm run format:check` for verification.
  ESLint remains responsible for correctness and code-quality rules.

### Components, functions, and styles

- React and React Native use functional components, hooks, and composition by
  default. Keep a screen focused on coordination; extract meaningful concepts
  such as cards, toolbars, lists, and form sections rather than arbitrary JSX
  wrappers.
- Use this component order where practical: types, constants, component,
  hooks/navigation, state, data hooks, derived values, handlers, effects,
  early returns, JSX, local helpers, styles.
- Treat a component above roughly 250–300 lines, a function above 50–75 lines,
  or a file above 500 lines as a review signal. Extract only when a coherent
  responsibility emerges; these are not automatic limits.
- Do not place complex calculations, nested conditionals, filtering/reducing, or
  API/database calls directly in JSX. Derive values and handlers before render.
- Keep StyleSheet and theme factories multiline and logically grouped with
  section comments for large style collections. Reuse semantic theme tokens and
  existing design primitives; do not introduce hardcoded feature colors where a
  token exists.
- Use descriptive domain names, `is`/`has`/`can`/`should` booleans, `handleX`
  internal event handlers, and `onX` callback props. Avoid variable shadowing,
  anonymous mega-callbacks, magic strings, and scattered domain thresholds.

### Architecture and boundaries

- Keep UI dependent on hooks/controllers, services/domain utilities, then
  APIs/repositories/Supabase. Domain and backend code must never depend on UI.
- Reuse the existing API clients, mobile finance services, backend services,
  date utilities, category registry, and theme architecture before adding a new
  abstraction. UI must not own complex Supabase queries, RLS details, or
  financial calculations.
- Financial formulas, money formatting/parsing, Manila date-only logic, status
  rules, categories, and cross-screen business rules each need one authoritative
  implementation. Preserve the accounting, RLS, API, navigation, and persistence
  behavior during structural refactors.
- Use services for real domain capabilities and repositories/adapters where they
  clarify persistence or external integrations. Do not create ceremonial layers,
  god services, generic utility dumping grounds, or duplicate clients.
- Apply SOLID pragmatically: cohesive modules, narrow contracts, and dependency
  inversion at meaningful external boundaries. OOP is appropriate for stateful
  infrastructure/adapters or substitutable integrations, not as a default.
  Prefer composition over inheritance; never convert React components to classes
  or invent inheritance trees solely to claim OOP.

### Type safety, errors, comments, and tests

- Keep TypeScript strict. Avoid `any`, unsafe casts, and `@ts-ignore`; use
  `unknown` with validation/narrowing. Public services and complex utilities
  should expose clear input and result contracts.
- Validate external input at API boundaries. Do not swallow errors or expose raw
  SQL, Supabase, stack, or internal-ID details to users. Map errors to safe
  domain/UI messages while retaining actionable server diagnostics.
- Use guard clauses to reduce nesting and maps/functions instead of nested
  ternaries. Remove obsolete commented-out implementations and dead imports.
- Comments and selective JSDoc explain *why*: financial accounting decisions,
  timezone semantics, security boundaries, platform workarounds, and non-obvious
  contracts. Never narrate obvious syntax. TODOs must name an actionable next
  step or owner/context.
- Tests follow the same readability rules. Use behavior-focused names and
  arrange/act/assert when useful. Financial tests must explicitly protect rules
  such as transfer-principal exclusion, interest treatment, reminder behavior,
  and OCR review-before-write behavior.

### Required pre-finish review

Before completing an implementation, review every changed file for line length,
readability, names, oversized responsibilities, duplicated logic, hardcoded
theme/domain values, type escapes, dead code, comments, error handling, and
business-logic placement. Run the formatter when configured, relevant lint and
typecheck/build commands, focused tests, and `git diff --check`. Report commands
and results honestly, including unavailable checks and pre-existing warnings.
