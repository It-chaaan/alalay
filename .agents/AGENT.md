Alalay Coding Agent Rules

Read this file completely before writing any code, creating any file, or running any command in this workspace. Every rule here reflects the **actual current state of the codebase**, not the original plan. Where something is planned but not yet built, it is explicitly marked `[PLANNED — not yet built]`.

---

## 1. Project identity

**Alalay** (Filipino: "to support / to assist") is a Filipino-first AI-powered personal finance web application. It helps users manage recurring bills, track subscriptions, monitor spending, and reach savings goals through an AI companion that speaks Filipino and English.

The product handles **money anxiety** — a deeply personal and stressful domain for Filipino users. Every design decision, copy choice, and UX pattern must feel calm, warm, and trustworthy. Never corporate, never alarming, never cold. Think of Alalay as a trusted friend who happens to know your finances — not a bank app.

The tone in all UI copy, error messages, empty states, and AI responses must be:
- Warm and direct — like a trusted friend
- Naturally bilingual — English and Filipino, code-switching is encouraged ("Kaya mo yan!")
- Never stiff, never ALL CAPS for emphasis, never "kindly note" or corporate filler phrases

---

## 2. Repo structure (actual)

```
alalay/
├── frontend/           ← React 19 + Vite 6 + TypeScript web app
├── backend/            ← Node.js + Express 5 API server
├── supabase/           ← Migrations, config, seed (seed.sql missing — see tech debt)
├── .agents/
│   ├── AGENT.md        ← this file
│   └── SKILL.md        ← Philippine biller + finance formatting conventions
└── README.md           ← project overview (links to .agents/ — not repo root)
```

**There is no monorepo.** No `packages/`, no `apps/`, no Turborepo, no root `package.json`. Frontend and backend are two separate projects under one repo — each has its own `package.json`, `node_modules`, `tsconfig.json`, and `.env`. When an agent needs to install dependencies or run scripts, it must `cd frontend/` or `cd backend/` first.

---

## 3. Tech stack (actual — do not substitute)

### Frontend (`frontend/`)
| Tool | Version | Notes |
|---|---|---|
| React | 19 | Not 18 — do not downgrade |
| Vite | 6 | Build tool |
| TypeScript | Latest | Strict mode — zero `any` tolerance |
| Tailwind CSS | Latest | Custom tokens defined in `tailwind.config.ts` |
| `@supabase/supabase-js` | Latest | Auth + DB client |
| `react-hook-form` | Latest | All forms |
| `@hookform/resolvers` | Latest | Zod integration for forms |
| `zod` | Latest | Validation schemas |

**Not in use — do not add without explicit approval:**
- ❌ React Router — routing is manual via `window.location.pathname` (see Section 5)
- ❌ TanStack Query — data fetching uses custom `useApiQuery` hook (see Section 6)
- ❌ Axios — HTTP calls use native `fetch` via `frontend/src/lib/apiClient.ts`
- ❌ shadcn/ui — components are custom-built (see Section 8)
- ❌ Recharts or any chart library — [PLANNED — not yet built]

### Backend (`backend/`)
| Tool | Version | Notes |
|---|---|---|
| Node.js | 20+ | Required |
| Express | 5 | Not 4 — Express 5 is already installed |
| TypeScript | Latest | |
| `@supabase/supabase-js` | Latest | Service role client — server-side only |
| `zod` | Latest | Request validation |
| `cors` | Latest | CORS middleware |
| `dotenv` | Latest | Environment loading |

**Not in use on the backend:**
- ❌ Prisma, TypeORM, or any ORM — all queries go through the Supabase JS client directly

### Infrastructure
| Tool | Purpose |
|---|---|
| Supabase | Postgres database, Auth (email + Google OAuth), Storage |
| Supabase Auth | `signInWithPassword`, `signInWithOAuth({ provider: 'google' })` |

---

## 4. Environment variables (actual)

### Frontend (`frontend/.env` / `frontend/.env.example`)
```
VITE_SUPABASE_URL=          # required
VITE_SUPABASE_ANON_KEY=     # required
VITE_API_URL=               # required — NOT in .env.example yet (tech debt — add it)
```
> ⚠️ `VITE_API_URL` is used in the code but missing from `frontend/.env.example`. Any agent touching environment setup must add it.

### Backend (`backend/.env` / `backend/.env.example`)
```
PORT=4000                   # default — old docs incorrectly say 3000
SUPABASE_URL=               # required
SUPABASE_SERVICE_ROLE_KEY=  # required — server-side only, never expose to frontend
GEMINI_API_KEY=             # required for AI routes
CORS_ORIGIN=http://localhost:5173
HTTPS_CERT_PATH=            # optional — supported in code but not in .env.example (tech debt)
HTTPS_KEY_PATH=             # optional — same
```
> ⚠️ Backend runs on **port 4000**, not 3000. Any docs, README sections, or curl examples using port 3000 are stale.

---

## 5. Routing (actual — manual, no React Router)

**There is no React Router.** Routing is handled manually in `frontend/src/App.tsx` using `window.location.pathname` switch logic. Navigation uses `window.location.assign()` and `window.location.replace()`.

**Rules for any agent working on routing:**
- Do not install React Router without explicit approval — it would require refactoring every page
- New pages must be added to the `window.location.pathname` switch in `App.tsx`
- Redirects use `window.location.assign(path)` for navigation and `window.location.replace(path)` for redirects that should not be in history
- The forgot-password route `/forgot-password` is linked from `AuthPage` but **does not exist** — this is a known gap (see Section 11)

**Current routes:**
```
/                   → HomePage (marketing page — fully built)
/auth               → AuthPage (login + register — fully built)
/dashboard          → DashboardPage
/bills              → BillsPage
/subscriptions      → SubscriptionsPage
/expenses           → ExpensesPage
/income             → IncomePage
/savings-goals      → SavingsGoalsPage
/budget             → BudgetPage
/reports            → ReportsPage
/settings           → SettingsPage
/ai-assistant       → AiAssistantPage (UI shell only)
/ocr-scanner        → OcrScannerPage (UI shell only)

[PLANNED — not yet built]:
/forgot-password    → no page exists, AuthPage links to it — broken
/onboarding         → flow not yet built as separate route
```

---

## 6. Data fetching (actual — custom hooks, no TanStack Query)

**There is no TanStack Query.** Data fetching uses a custom `useApiQuery` hook in `frontend/src/hooks/` that wraps native `fetch`. All hooks that fetch data are built on top of `useApiQuery`.

### API client
Located at `frontend/src/lib/apiClient.ts`. It:
- Reads `VITE_API_URL` from env
- Gets the current Supabase session
- Attaches `Authorization: Bearer <access_token>` to every request automatically
- Returns parsed JSON or throws a typed error

### Built hooks (all read-only GET — no mutations yet)
```
useApiQuery         base hook — do not use directly in components, use the resource hooks
useBills()          GET /api/bills
useExpenses()       GET /api/expenses
useIncome()         GET /api/income
useSubscriptions()  GET /api/subscriptions
useSavingsGoals()   GET /api/savings-goals
useBudget()         GET /api/budget/summary
useReports()        GET /api/reports/summary
useDashboard()      GET /api/dashboard/summary
useSettings()       GET /api/users/me
useAiAssistant()    GET /api/ai/status
useOcrScanner()     GET /api/ocr/capabilities
```

> ⚠️ **All hooks are read-only.** There are currently **no mutation hooks** for create, update, or delete operations. Many UI action buttons (add, edit, delete, save settings) are presentational only and not wired to the backend. When building mutations, follow this pattern:
> ```typescript
> // Use fetch + apiClient directly for mutations until a mutation hook pattern is established
> const response = await apiClient.post('/api/bills', payload)
> // Then manually re-fetch or trigger a state refresh — there is no cache to invalidate
> ```

### No cache invalidation pattern yet
Because TanStack Query is not used, there is no automatic cache invalidation. When a mutation succeeds, the page must be refreshed or the hook must be manually re-triggered. If building mutations, keep this in mind — do not assume cache invalidation works automatically.

---

## 7. Backend architecture (actual)

```
backend/src/
├── server.ts               ← re-export only, not the real setup
├── services/
│   └── server.ts           ← real Express app setup lives here (unusual — do not move without updating imports)
├── routes/
│   ├── index.ts            ← mounts all /api/* routes
│   ├── bills.routes.ts
│   ├── expenses.routes.ts
│   ├── income.routes.ts
│   ├── subscriptions.routes.ts
│   ├── savings-goals.routes.ts
│   ├── dashboard.routes.ts
│   ├── budget.routes.ts
│   ├── reports.routes.ts
│   ├── users.routes.ts
│   ├── ai.routes.ts
│   ├── ocr.routes.ts
│   └── health.ts           ← legacy, appears unused — do not reference
├── controllers/            ← thin — call service, return response
├── services/               ← business logic + Supabase queries
├── middleware/
│   ├── auth.ts             ← requireAuth — verifies Supabase JWT, attaches req.user
│   ├── errorHandler.ts     ← centralized error response
│   └── validateRequest.ts  ← Zod schema validation
└── schemas/                ← Zod request schemas per resource
```

> ⚠️ `backend/src/routes/resource.routes.ts` contains an **unused `bills` schema mapping that incorrectly points to expense schemas**. Do not reference or extend this file — it is stale and should be deleted when touched.

### Middleware stack (in order)
```
cors → express.json → requireAuth (all /api/* routes) → validateRequest → controller → errorHandler
```

### Standard response shape — use this everywhere
```typescript
// success
{ success: true, data: T }

// error
{ success: false, error: { code: string, message: string } }
```

### All implemented API routes
```
Public:
  GET  /health

Protected (require Authorization: Bearer <jwt>):
  GET  /api/dashboard/summary
  GET  /api/budget/summary
  GET  /api/reports/summary

  GET    /api/bills
  POST   /api/bills
  GET    /api/bills/:id
  PATCH  /api/bills/:id
  DELETE /api/bills/:id          (soft delete — sets deleted_at)
  PATCH  /api/bills/:id/pay      (sets status=paid + paid_at)

  GET    /api/expenses
  POST   /api/expenses
  GET    /api/expenses/:id
  PATCH  /api/expenses/:id
  DELETE /api/expenses/:id       (soft delete)

  GET    /api/income
  POST   /api/income
  GET    /api/income/:id
  PATCH  /api/income/:id
  DELETE /api/income/:id         (soft delete)
  GET    /api/income/summary

  GET    /api/subscriptions
  POST   /api/subscriptions
  GET    /api/subscriptions/:id
  PATCH  /api/subscriptions/:id
  DELETE /api/subscriptions/:id  (soft delete)

  GET    /api/savings-goals
  POST   /api/savings-goals
  GET    /api/savings-goals/:id
  PATCH  /api/savings-goals/:id
  DELETE /api/savings-goals/:id  (soft delete)

  GET    /api/users/me
  PATCH  /api/users/me
  PATCH  /api/users/me/onboarding

  GET    /api/ai/status
  POST   /api/ai/chat

  GET    /api/ocr/capabilities
  POST   /api/ocr/demo           (demo only — does not process real files)
```

---

## 8. Component inventory (actual)

Before creating any new component, check this list. Reuse and extend what exists — do not create duplicates.

### ✅ Exists — use these
```
frontend/src/components/ui/
  Button          props: variant, size, onClick, disabled, loading?, children
  TextInput       props: label, placeholder, type, error, ...inputProps

frontend/src/components/layout/
  Container       max-width wrapper
  DashboardShell  sidebar + main content layout wrapper for authenticated pages

frontend/src/components/navigation/
  Navbar          top nav for marketing pages (HomePage)
  DashboardSidebar  left sidebar for authenticated pages

frontend/src/components/dashboard/
  QuickActions    quick action buttons row on the dashboard
```

### ❌ Not yet built — planned
```
StatCard          (dashboard stat cards)
BillRow           (bills table row)
BillStatusPill    (overdue/upcoming/paid status chip)
BillSidePanel     (slide-in panel for bill create/edit)
EmptyState        (consistent empty state across pages)
LoadingSkeleton   (shimmer loading state)
SidePanel         (generic slide-in right panel)
AiInsightCard     (AI insight card with teal border)
HealthScoreRing   (circular score gauge)
QuickAddFab       (floating + button)
ChatBubble        (AI assistant message bubbles)
CategoryChip      (colored category label)
```

When building any component from the "not yet built" list, place it in the appropriate subdirectory under `frontend/src/components/` — not a new top-level folder.

---

## 9. Folder and file conventions (actual)

```
frontend/src/
├── components/         ← React components (see Section 8)
├── hooks/              ← all data hooks + types.ts (shared frontend types live here)
├── lib/
│   ├── apiClient.ts    ← fetch wrapper with auth header
│   └── supabase.ts     ← Supabase browser client (anon key)
├── utils/
│   └── formatters.ts   ← formatCurrency, formatDateShort, formatMonthYear (see SKILL.md)
├── constants/
│   ├── auth.ts
│   ├── dashboard.ts
│   └── mobileDownload.ts
└── pages/              ← one file per route

backend/src/
├── routes/             ← route definitions only (no logic)
├── controllers/        ← thin — call service, return response
├── services/           ← business logic + Supabase queries
├── middleware/         ← auth, errorHandler, validateRequest
└── schemas/            ← Zod request validation schemas
```

**Key differences from original plan:**
- Types are in `frontend/src/hooks/types.ts`, not `src/types/index.ts`
- Formatters are in `frontend/src/utils/formatters.ts`, not `src/lib/formatters.ts`
- Constants are in `frontend/src/constants/`, not `src/lib/constants.ts`
- No `PH_BILLERS` or `CATEGORIES` constants exist yet — these must be created when needed

---

## 10. Design system (actual)

### Tailwind tokens that actually exist (`tailwind.config.ts`)
The following custom tokens are defined — use these, never hardcode hex values:
```
brand.*       ← primary brand colors (teal family)
app.*         ← UI surface and text colors
shadow.glow   ← teal glow shadow
```

> Run `cat frontend/tailwind.config.ts` to see the exact token names before referencing them. Do not guess.

### Typography (actual)
- `Inter` is in the font stack in `frontend/src/index.css` as a local/system fallback only
- **No Google Fonts are loaded** — `frontend/index.html` has no `<link>` for Google Fonts
- Plus Jakarta Sans and JetBrains Mono from the original plan **are not loaded**
- [PLANNED] Load Google Fonts properly in `index.html` when typography is being addressed

### Design system tech debt — fix when touching these files
The following components and pages use **hardcoded arbitrary values** instead of Tailwind tokens. Fix them when you touch these files — do not introduce new hardcoded values:

```
frontend/src/pages/HomePage.tsx         bg-[#0f8a6b], and others
frontend/src/components/navigation/Navbar.tsx
frontend/src/components/navigation/DashboardSidebar.tsx
frontend/src/pages/IncomePage.tsx
frontend/src/pages/BudgetPage.tsx
frontend/src/pages/ReportsPage.tsx
frontend/src/index.css                  arbitrary classes, hardcoded colors
```

**Never add new hardcoded hex values or arbitrary Tailwind classes.** If a token doesn't exist in `tailwind.config.ts` for what you need, add the token there first, then reference it.

---

## 11. Database (actual)

One migration file exists at `supabase/migrations/`. It creates 10 tables.

### Tables with full soft-delete + updated_at support ✅
`users`, `bills`, `expenses`, `income`, `subscriptions`, `savings_goals`, `families`

### Tables missing `deleted_at` ⚠️
`notifications`, `ai_insights`, `gmail_connections`, `bill_suggestions`
→ Add `deleted_at timestamptz` when next touching these tables

### Tables missing `updated_at` + trigger ⚠️
`notifications`, `ai_insights`, `gmail_connections`, `bill_suggestions`
→ Add `updated_at` column + `set_updated_at` trigger when next touching these tables

### RLS status
✅ RLS is enabled on **all 10 tables**. Every table has a policy scoped to `auth.uid()`. Do not create any new table without enabling RLS in the same migration.

### ⚠️ CRITICAL BUG — broken soft-delete triggers
The following triggers all call `public.soft_delete_bills()`, which updates `public.bills` instead of their own table:
- `expenses_soft_delete`
- `income_soft_delete`
- `subscriptions_soft_delete`
- `savings_goals_soft_delete`

**This means direct SQL `DELETE` on these tables silently soft-deletes bills instead.** The backend currently avoids this bug by using `update({ deleted_at: new Date() })` directly from the service layer (not a SQL DELETE), so the API is currently safe. However, any future migration, seed script, or direct SQL operation that issues a real `DELETE` on these tables will corrupt bills data. Fix these triggers in the next schema migration.

### Missing seed file
`supabase/config.toml` enables seed loading from `./seed.sql`, but `supabase/seed.sql` does not exist. Running `supabase db reset` will fail with a missing file error. Create `supabase/seed.sql` (even if empty) or disable seed loading in `config.toml`.

---

## 12. Known bugs and gaps

### Bugs
- **Broken soft-delete triggers** (critical) — see Section 11
- **Missing `VITE_API_URL` in `frontend/.env.example`** — new developers will get a silent failure on API calls
- **`/forgot-password` route does not exist** — `AuthPage` links to it, users hit a 404
- **Stale date hardcodes** — `DashboardPage`, `BudgetPage`, `ReportsPage`, and `HomePage` contain hardcoded copy like "Saturday, June 28, 2025", "June 2025", "Q2 2025", "© 2025" — these must be dynamically generated
- **Dashboard "Last 8 months" lie** — the label says "Last 8 months" but the backend returns only one `monthly_spending` data point `{ month: "Current", value: ... }` — the chart is misleading
- **`BudgetPage` uses hardcoded categories** — budget categories and amounts are hardcoded in `backend/src/services/analytics.service.ts`, not user-defined
- **`AI Assistant` says "Active · Bilingual"** — but `/api/ai/status` returns `status: "not_configured"`. The UI is lying to the user.
- **`OCR Scanner` upload UI exists but does nothing** — backend only returns demo/capabilities data, no file processing
- **`SettingsPage` does not save** — loads profile from `/api/users/me` but does not submit updates back
- **`resource.routes.ts` bills mapping points to expense schemas** — stale file, do not use
- **`backend/src/routes/health.ts`** — appears unused, potential dead code

### Presentational-only UI (not yet wired to backend)
These UI elements render correctly but do nothing when interacted with:
- Add bill / expense / income / subscription / savings goal buttons
- Search inputs on list pages
- Filter tabs on list pages
- Export buttons (PDF/CSV) on Reports page
- Edit budget on Budget page
- Save settings on Settings page
- AI chat input
- OCR scan/upload flow

### Broken external links on HomePage
`#demo`, `#privacy`, `#terms`, `#updates`, `#help-center`, `#contact`, `#status`, `#community` are all `href="#"` placeholders.

### Performance
Frontend main bundle is ~594 kB (warned during `npm run build`). Code splitting is pending — implement dynamic `import()` for page components when routes are being refactored.

---

## 13. Security rules (non-negotiable)

1. **`SUPABASE_SERVICE_ROLE_KEY` is backend-only** — never reference it in `frontend/`, never add it to `VITE_*` env vars
2. **Gmail tokens (`access_token`, `refresh_token` in `gmail_connections`)** must only be read and written by server-side code — never returned to the frontend, never in a frontend query
3. **RLS on every table** — every new table must have `alter table ... enable row level security` and a user-scoped policy in the same migration it is created in, never in a later one
4. **Soft deletes only** — never issue a hard `DELETE FROM` on any table containing user financial data. Always `update({ deleted_at: new Date() })`. The broken triggers in Section 11 make this especially important right now.
5. **User-scoped queries in backend** — even though RLS is enabled, every backend Supabase query must explicitly filter by `user_id = req.user.id`. Never rely on RLS alone as the only access control layer.

---

## 14. What the agent must never do

- Never hard-delete rows from `bills`, `expenses`, `income`, `subscriptions`, `savings_goals`, or `users`
- Never add `SUPABASE_SERVICE_ROLE_KEY` to any frontend env file or Vite config
- Never add a new npm dependency without checking if the existing stack already solves the problem
- Never install React Router, TanStack Query, or Axios without explicit approval — these would require significant refactoring
- Never attempt to scrape or directly call Meralco, PLDT, Maynilad, or any Philippine biller website — they have no public APIs
- Never assume the Gmail bill sync works fully — see SKILL.md for the confirmed limitations
- Never present AI Assistant as "Active" or "Bilingual" in UI copy until the backend actually confirms it is configured — the current UI is misleading users
- Never introduce new hardcoded hex values or arbitrary Tailwind classes — use tokens
- Never create a file in a new top-level folder without checking if it belongs in an existing one first
- Never write business logic in a controller — controllers call services, services contain logic