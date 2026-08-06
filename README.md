# Alalay

## Security controls and deployment requirements

- Supabase Auth is called directly by the frontend, so login, signup, password-reset, and MFA throttling must be enabled in the Supabase Auth settings and/or the production edge gateway. The backend rate limiters cover authenticated API writes, AI/OCR cost surfaces, and trusted-device issuance; the in-memory limiter must use a shared gateway/Redis policy when running multiple backend instances.
- Production backend startup requires `NODE_ENV=production`, `HTTPS_ENABLED=true`, HTTPS `APP_URL`/`CORS_ORIGIN`, and HSTS. Keep `HTTPS_TERMINATE_LOCALLY=false` on Render/Heroku/Railway/Vercel-style platforms; set it to `true` and provide certificate/key paths only for a self-hosted process that terminates TLS itself.
- Set `SUPABASE_ANON_KEY` so authenticated request paths use the caller JWT and Supabase RLS. The service-role key is reserved for auth verification and background schedulers; never expose it to the frontend.
- Confirm in the Supabase dashboard that passwords use bcrypt or an equivalent strong scheme, breached-password checks are enabled, and password-strength rules are appropriate for the product.
- OCR is currently browser-only. If receipts are uploaded or persisted in the future, isolate processing, validate files server-side, and add malware scanning before storage or provider submission.
- Bearer tokens remain a product architecture decision. A BFF with HttpOnly, SameSite cookies is the preferred follow-up; until then, keep the frontend CSP and hosting headers strict and use short-lived Supabase sessions with refresh enabled.

Alalay is a Filipino-first personal finance web application for managing bills, subscriptions, expenses, income, savings goals, budgets, reports, OCR-assisted entry, and AI-guided financial insights.

## Current implementation status

This repository already contains:

- a React frontend
- an Express backend
- Supabase-backed auth and data storage
- a Gemini-backed AI chat assistant; the dashboard AI insight card is still a placeholder
- a browser-side OCR flow using `tesseract.js`

## Architecture

### Frontend

- React 19
- TypeScript
- Vite
- Tailwind CSS plus shared app CSS
- manual routing in `frontend/src/App.tsx`

### Backend

- Express
- TypeScript
- Zod validation
- Supabase integration

### Database

- Supabase Postgres
- migrations under `supabase/migrations/`
- RLS-enabled application tables

### AI

- Google Gemini Flash 2.5
- backend routes for status, chat, and streaming chat

### OCR

- frontend-side OCR implemented with `tesseract.js`

## Current routes

Frontend routes currently implemented:

- `/`
- `/login`, `/register`, `/forgot-password`, `/reset-password`
- `/auth/callback`
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


## Current feature set

- authentication and protected app shell
- email/password and Google OAuth sign-in
- authenticator-app TOTP two-factor verification
- dashboard summaries
- bills management
- subscriptions management
- expenses tracking
- income tracking
- savings goals
- budget planning
- reports and analytics
- AI assistant
- OCR scanner
- settings and profile management

## Backend API summary

The backend exposes authenticated `/api/*` routes plus supporting endpoints. Notable implemented areas include:

- auth and user profile APIs
- bills
- subscriptions
- expenses
- income
- savings goals
- budget
- reports and analytics
- AI assistant:
  - `GET /api/ai/status`
  - `POST /api/ai/chat`
  - `POST /api/ai/chat/stream`
- OCR capability and demo endpoints

## Database tables currently present

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

The current schema includes `users.phone`.

## Setup

### Prerequisites

- Node.js 20+
- npm

### Install

```bash
cd frontend
npm install
```

```bash
cd backend
npm install
```

### Run the frontend

```bash
cd frontend
npm run dev
```

### Run the backend

```bash
cd backend
npm run dev
```

The frontend runs on the Vite dev server. The backend currently defaults to port `4000` in active project usage unless overridden by `PORT`.

## Environment variables

### Frontend

- `VITE_SUPABASE_URL` - Supabase project URL
- `VITE_SUPABASE_ANON_KEY` - Supabase browser anon key
- `VITE_API_URL` - optional backend base URL override used by the frontend API client

### Backend

- `PORT`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `GEMINI_API_KEY`
- `GEMINI_MODEL`
- `GEMINI_THINKING_BUDGET`
- `CORS_ORIGIN`
- `HTTPS_ENABLED`
- `HTTPS_TERMINATE_LOCALLY`
- `HTTPS_CERT_PATH` / `HTTPS_KEY_PATH` (only for local TLS termination)

`VITE_API_URL` is not currently listed in `frontend/.env.example`.

## Supabase notes

- schema changes must go through `supabase/migrations/`
- RLS is enabled on the current application tables
- `supabase/config.toml` references `seed.sql`, but that file is currently missing

## AI and OCR notes

- AI chat is implemented with Google Gemini Flash through the backend
- The dashboard AI insight card is not connected to the chat service and still returns a not-configured placeholder; do not treat it as complete
- assistant responses are rendered as markdown in the chat UI
- OCR is currently executed in the browser via `tesseract.js`, not through a backend extraction pipeline

## Documentation

Implementation-facing AI documentation lives here:

- [.agents/Agents.md](./.agents/Agents.md)
- [.agents/SKILL.md](./.agents/SKILL.md)

These files must be updated whenever architecture, schema, AI flows, OCR flows, or financial logic changes.
