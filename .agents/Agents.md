# Alalay Agent Reference

## Project overview

Alalay is a Filipino-first personal finance web application. The current implementation covers account authentication, household-aware finance tracking, bills, subscriptions, expenses, income, savings goals, budget planning, reports, OCR-assisted entry, and a working AI assistant backed by Google Gemini.

This document is the implementation-derived reference for future AI-assisted changes. It must stay aligned with the codebase.

## Repository structure

```text
frontend/   React 19 + TypeScript + Vite application
backend/    Express + TypeScript API server
supabase/   SQL migrations, config, generated types
.agents/    AI-facing project instructions
```

## Current architecture

### Frontend

- Framework: React 19 with TypeScript
- Build tool: Vite
- Styling: Tailwind utility classes plus shared CSS in `frontend/src/index.css`
- Routing: manual route switching in `frontend/src/App.tsx`
- State model:
  - React local state for page concerns
  - Auth state through `frontend/src/contexts/AuthContext.tsx`
  - Data fetching through shared hooks:
    - `frontend/src/hooks/useApiQuery.ts`
    - `frontend/src/hooks/useApiMutation.ts`
- API access through `frontend/src/lib/api.ts`

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
- Frontend session source: `AuthContext`
- Backend protection: auth middleware on `/api/*` routes
- Protected UI: dashboard routes gated in `frontend/src/App.tsx`

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

There is no working `/forgot-password` route in the current app.

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

## Data flow

1. Frontend route/page calls `useApiQuery` or `useApiMutation`.
2. Requests go through `frontend/src/lib/api.ts`.
3. Backend auth middleware resolves the current user from Supabase tokens.
4. Route handlers validate payloads and call service-layer logic.
5. Services read/write Supabase tables and compute analytics where needed.
6. Frontend updates local page state from normalized API responses.

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

## Known implementation issues

- `supabase/config.toml` references `seed.sql`, but the file is missing.
- `backend/src/routes/resource.routes.ts` contains stale schema mapping for `bills`.
- `backend/src/routes/health.ts` appears unused.
- `frontend/src/pages/dashboard/AppPlaceholderPage.tsx` appears unused.
- Budget PATCH validation is weaker than other routes.
- Several soft-delete triggers still point at `soft_delete_bills()` for non-bill tables.
- Some user settings and AI chat history are stored in `localStorage`.
- Hardcoded colors remain in parts of the frontend instead of centralized tokens.

## Documentation synchronization rules

Whenever architecture, schema, APIs, AI flows, OCR behavior, or financial logic changes, update:

- `.agents/Agents.md`
- `.agents/SKILL.md`
- `README.md`

Do not leave implementation changes undocumented.
