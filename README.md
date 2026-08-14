# Alalay

Wallet transfers are atomic internal movements: transfer principal does not affect income or spending, while any recorded transfer fee is a `Bank Fees` expense. Actual interest credits are recorded as income and are separate from wallet interest-rate metadata.

Loans and personal debt use a shared balance-sheet ledger: money lent is a receivable and money borrowed is a liability. Principal movements change the chosen wallet and outstanding balance without affecting reports; only interest received is income and interest paid is a `Debt / Loan` expense. The backend records loan creation, partial repayments, and write-offs atomically through authenticated database functions.

The mobile Loans & Debt experience is opened from Wallets and supports direction-first entry, optional due dates, expected fixed/simple interest, active/history grouping, payment detail history, split principal/interest repayments, overdue display, and confirmed receivable write-offs.

Loans and personal debt use a shared balance-sheet ledger: money lent is a receivable and money borrowed is a liability. Principal movements change the chosen wallet and outstanding balance without affecting reports; only interest received is income and interest paid is a `Debt / Loan` expense. The backend records loan creation, partial repayments, and write-offs atomically through authenticated database functions.

## Security controls and deployment requirements

- Supabase Auth is called directly by the frontend, so login, signup, password-reset, and MFA throttling must be enabled in the Supabase Auth settings and/or the production edge gateway. The backend rate limiters cover authenticated API writes, AI/OCR cost surfaces, and trusted-device issuance; the in-memory limiter must use a shared gateway/Redis policy when running multiple backend instances.
- Production backend startup requires `NODE_ENV=production`, `HTTPS_ENABLED=true`, HTTPS `APP_URL`/`CORS_ORIGIN`, and HSTS. Keep `HTTPS_TERMINATE_LOCALLY=false` on Render/Heroku/Railway/Vercel-style platforms; set it to `true` and provide certificate/key paths only for a self-hosted process that terminates TLS itself.
- Set `SUPABASE_ANON_KEY` so authenticated request paths use the caller JWT and Supabase RLS. The service-role key is reserved for auth verification and background schedulers; never expose it to the frontend or mobile app.
- Confirm in the Supabase dashboard that passwords use bcrypt or an equivalent strong scheme, breached-password checks are enabled, and password-strength rules are appropriate for the product.
- OCR is currently browser-only on web. If receipts are uploaded or persisted in the future (on web or mobile), isolate processing, validate files server-side, and add malware scanning before storage or provider submission.
- Bearer tokens remain a product architecture decision. A BFF with HttpOnly, SameSite cookies is the preferred follow-up for web; until then, keep the frontend CSP and hosting headers strict and use short-lived Supabase sessions with refresh enabled. The mobile app stores its session using secure on-device storage (see `mobile/lib/supabase.ts`), not browser storage patterns.

Alalay is a Filipino-first personal finance app for managing bills, subscriptions, expenses, income, savings goals, budgets, reports, OCR-assisted entry, and AI-guided financial insights. It currently ships as a web application, with a React Native (Expo) mobile app in active development that shares the same backend and Supabase project.

## Repository structure

```text
frontend/   React web application
backend/    Express + TypeScript API server (shared by web and mobile)
mobile/     React Native (Expo) mobile application
supabase/   SQL migrations, config, generated types (shared by web and mobile)
.agents/    AI-facing project instructions for web, mobile, backend, and shared infrastructure
```

Mobile setup is documented in `mobile/.env.example` and its `.agents` guidance; there is no `mobile/README.md` in the current repository.

The mobile app is a separate client only — it does not have its own backend or database. See `mobile/README.md` for mobile-specific setup, and `mobile/.agents/AGENTS.md` / `mobile/.agents/SKILL.md` for mobile-specific implementation and design guidance.

## Current implementation status

The capability notes in this section describe the implemented web/shared-backend surface. They should not be read as a claim that the mobile client already exposes every web feature; mobile is active development and its verified status is documented in `mobile/.agents/AGENTS.md`.

This repository already contains:

- a React frontend (web)
- a React Native (Expo) mobile app, in active development
- an Express backend, shared by both clients
- Supabase-backed auth and data storage
- a Gemini-backed AI chat assistant; the dashboard AI insight card is still a placeholder
- a browser-side OCR flow using `tesseract.js` on web (mobile OCR approach is a separate, not-yet-finalized implementation decision — see `mobile/.agents/AGENTS.md`)

## Architecture

### Frontend (web)

- React 19
- TypeScript
- Vite
- Tailwind CSS plus shared app CSS
- manual routing in `frontend/src/App.tsx`

### Mobile

- React Native via Expo (SDK 54)
- TypeScript
- Expo Router
- StyleSheet-based screen styling and palette objects
- Platform-aware Supabase session persistence: Expo SecureStore on iOS/Android and guarded `localStorage` for Expo web preview
- Expo WebBrowser/Linking and Supabase PKCE settings for Google OAuth
- `react-native-svg` for the landing feature carousel artwork
- The current app contains a landing carousel, auth screens, and a tailored two-tab authenticated shell. The shared mobile API helper currently powers the authenticated Alalay chat-head's dashboard insight and AI chat; the remaining feature screens are still partial.

### Backend

- Express
- TypeScript
- Zod validation
- Supabase integration
- Shared by both the web frontend and the mobile app — no mobile-specific backend exists

### Database

- Supabase Postgres
- migrations under `supabase/migrations/`
- RLS-enabled application tables
- Shared by both web and mobile; no separate mobile schema

### AI

- Google Gemini Flash 2.5
- backend routes for status, chat, and streaming chat
- These routes are currently consumed by the web client; mobile has not yet implemented its API/data layer

### OCR

- Web: frontend-side OCR implemented with `tesseract.js`
- Mobile: not yet implemented; requires a separate approach since `tesseract.js` does not run in React Native (see `mobile/.agents/AGENTS.md` for the open decision between on-device native OCR vs. a new backend OCR endpoint)

## Current routes

Frontend (web) routes currently implemented:

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

Mobile does not yet mirror this route list. Its current Expo Router inventory is the landing screen (`app/index.tsx`), auth (`app/auth.tsx`), modal, and authenticated Home, Budget, Settings, and Explore destinations under `app/(tabs)/`; the default tab chrome is hidden behind the custom Home floating nav.

## Current feature set

- authentication and protected app shell
- email/password and Google OAuth sign-in
- authenticator-app TOTP two-factor verification
- dashboard summary presentation (mobile Home currently uses mock display data, with a real authenticated AI insight/chat-head)
- mobile Home fixed monthly overview card and compact finance shortcuts, with totals supplied by the shared dashboard summary API
- mobile Budget category-limit view backed by the shared budget summary API
- mobile Settings destination placeholder
- bills management
- subscriptions management
- expenses tracking
- income tracking
- Goals (legacy internal route/table names may still use savings terminology)
- budget planning
- reports and analytics
  - Report expense totals reconcile with category breakdowns, and daily trends include zero-spend dates across the selected period.
  - Report navigation, timeline statuses, budget filters, and chart labels help users interpret long report pages.
- AI assistant
- OCR scanner (web only; mobile pending)
- settings and profile management

This feature set is the target for both web and mobile. Mobile implementation status may lag behind web — check `mobile/README.md` for what's currently working on mobile specifically.

## Backend API summary

The backend exposes authenticated `/api/*` routes plus supporting endpoints, shared by both web and mobile clients. Notable implemented areas include:

- auth and user profile APIs
- dashboard preference APIs (`/api/users/me/dashboard-preferences`)
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
- For mobile: Expo Go app (matching the project's pinned Expo SDK — currently SDK 54) on a physical device, or an iOS/Android simulator

### Install

```bash
cd frontend
npm install
```

```bash
cd backend
npm install
```

```bash
cd mobile
npm install
```

### Run the frontend (web)

```bash
cd frontend
npm run dev
```

### Run the backend

```bash
cd backend
npm run dev
```

The frontend runs on the Vite dev server. The backend currently defaults to port `4000` in active project usage unless overridden by `PORT` — note this has been a source of confusion where some frontend code paths pointed at the wrong port during development; confirm the actual running port with `npm run dev`'s startup log if requests aren't reaching the backend.

### Run the mobile app

```bash
cd mobile
npx expo start
```

Scan the printed QR code with Expo Go (physical device) or press `a`/`i` to launch an Android/iOS simulator, if configured. Mobile environment variables are documented below and in `mobile/.env.example`.

## Environment variables

### Frontend (web)

- `VITE_SUPABASE_URL` - Supabase project URL
- `VITE_SUPABASE_ANON_KEY` - Supabase browser anon key
- `VITE_API_URL` - optional backend base URL override used by the frontend API client

### Mobile

- `EXPO_PUBLIC_SUPABASE_URL` - Supabase project URL (same project as web)
- `EXPO_PUBLIC_SUPABASE_ANON_KEY` - Supabase anon key (same value as web's `VITE_SUPABASE_ANON_KEY`)
- `EXPO_PUBLIC_API_URL` - backend base URL used by the mobile API client. When testing on a physical device over Wi-Fi, this must be a reachable network address (deployed backend URL, or your machine's local network IP for local backend testing) — `localhost` will not resolve correctly from a phone.

Expo requires the `EXPO_PUBLIC_` prefix for any environment variable exposed to client code; this is not interchangeable with the web app's `VITE_` prefix.

### Backend

- `PORT`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
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
- schema and migrations are shared between web and mobile — do not create a mobile-specific schema fork

## AI and OCR notes

- AI chat is implemented with Google Gemini Flash through the backend for web and the mobile chat-head; mobile uses `mobile/src/services/api.ts` to authenticate its dashboard-insight and chat requests
- The web dashboard insight card and mobile chat-head obtain their insight from the authenticated dashboard summary. Mobile's other dashboard figures remain presentation-only mock data.
- Assistant responses are rendered as markdown in the chat UI on web. Mobile's chat-head currently presents the backend response as native text bubbles; add a React Native markdown renderer before relying on rich markdown formatting there.
- OCR is currently executed in the browser via `tesseract.js` on web, not through a backend extraction pipeline. Mobile OCR is not yet implemented and requires a different technical approach (see `mobile/.agents/AGENTS.md`)

## Documentation

Implementation-facing AI documentation:

- Web/backend: [.agents/Agents.md](./.agents/Agents.md), [.agents/SKILL.md](./.agents/SKILL.md)
- Mobile: [mobile/.agents/AGENTS.md](./mobile/.agents/AGENTS.md), [mobile/.agents/SKILL.md](./mobile/.agents/SKILL.md)

These files must be updated whenever architecture, schema, AI flows, OCR flows, navigation, or financial logic changes, for the relevant client(s).

## Profile data flow

Supabase Auth owns the authenticated user identity and email. Application profile fields are stored in `public.users` and accessed through the authenticated shared `GET/PATCH /api/users/me` endpoint. Mobile screens share normalized profile state so saved display-name, phone, and avatar changes propagate to Home and Settings.

Mobile appearance is persisted device-locally as `system`, `light`, or `dark` and resolved centrally by `mobile/src/theme/theme.tsx`.
