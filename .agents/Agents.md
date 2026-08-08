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
- Navigation: Expo Router with a root stack and a two-tab scaffold (`Home` and `Explore`)
- Styling: React Native `StyleSheet` and palette objects; no NativeWind/Tailwind layer
- Current routes/files: `app/index.tsx` (the sole landing carousel), `app/auth.tsx` (sign-in/sign-up), `app/(tabs)/index.tsx`, `app/(tabs)/explore.tsx`, and `app/modal.tsx`
- Shared components/hooks: `components/`, `hooks/use-color-scheme.ts`, `hooks/use-theme-color.ts`, and `constants/theme.ts`
- Native dependencies used by the current UI include Expo Image, Expo SecureStore, Expo WebBrowser, Expo Linking, React Navigation, React Native Reanimated, React Native SVG, safe-area-context, and vector icons
- Supabase client: `mobile/lib/supabase.ts`; it uses `@supabase/supabase-js` with SecureStore-backed session persistence and PKCE OAuth settings
- Theme: the current product code intentionally forces the shared color-scheme hook to `light`; no mobile Settings/preferences screen or three-way theme persistence is implemented
- The mobile app does not currently contain the web client's API hooks, dashboard feature screens, or a mobile AuthContext equivalent

### Shared infrastructure

- `backend/` is the shared Express API server for web and any future mobile API integration.
- `supabase/` contains the single shared Postgres schema, migrations, RLS policies, and generated types used as the source of truth.
- Do not create a mobile-specific backend, Supabase project, schema fork, or duplicate financial calculation layer.

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
  - `notifications`
  - `ai_insights`
  - `gmail_connections`
  - `bill_suggestions`
  - `budget_plans`
  - `savings_preferences`

`users.phone` is part of the schema in current migrations.

### Authentication

- Provider: Supabase Auth
- Web session source: Supabase session handling in `frontend/src/App.tsx`
- Mobile auth: `mobile/app/auth.tsx` calls Supabase Auth directly through `mobile/lib/supabase.ts`
- Backend protection: auth middleware on `/api/*` routes
- Protected UI: dashboard routes gated in `frontend/src/App.tsx`
- Mobile session persistence uses Expo SecureStore; mobile OAuth uses a PKCE/deep-link flow through Expo WebBrowser/Linking.

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

### OCR

- OCR is implemented in the frontend, not as a backend extraction pipeline.
- Main page: `frontend/src/pages/dashboard/OcrScannerPage.tsx`
- Engine: `tesseract.js`
- Backend OCR routes currently expose capabilities/demo endpoints only.
- Mobile OCR is not implemented; browser `tesseract.js` must not be copied into React Native without a separate compatible approach.

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

### Savings goals

- Goal CRUD and progress tracking

### Budget

- Budget plan persistence via `budget_plans`
- Monthly totals and budget comparisons

### Reports

- Analytical summaries and trends
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
- Two-tab Expo Router starter scaffold
- No mobile dashboard, bills, subscriptions, expenses, income, savings goals, budget, reports, AI assistant, OCR scanner, or Settings feature screens are currently implemented in `mobile/`

## Data flow

### Web flow

1. Frontend route/page calls `useApiQuery` or `useApiMutation`.
2. Requests go through `frontend/src/lib/apiClient.ts`.
3. Backend auth middleware resolves the current user from Supabase tokens.
4. Route handlers validate payloads and call service-layer logic.
5. Services read/write Supabase tables and compute analytics where needed.
6. Frontend updates local page state from normalized API responses.

### Mobile flow

The current mobile implementation calls Supabase Auth directly for its auth screens and persists sessions with SecureStore. A mobile API client/data-fetching layer is not currently present; when mobile feature screens are added, they should reuse the shared authenticated backend/API contracts rather than duplicate business logic.

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

The current mobile Supabase auth client reads the two Supabase variables. Mobile API usage is not yet implemented in the checked-in client.

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
- Mobile auth sessions must use SecureStore or another secure on-device mechanism; do not use browser storage or plain AsyncStorage for session tokens.

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
