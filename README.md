# Alalay

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
- `HTTPS_CERT_PATH`
- `HTTPS_KEY_PATH`

`VITE_API_URL` is not currently listed in `frontend/.env.example`; HTTPS certificate paths are supported by backend code but are not currently listed in `backend/.env.example`.

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
