# Alalay Agent Instructions

## 1. Project Identity

Alalay is a Filipino-first personal finance assistant for people who want calmer help with bills, expenses, subscriptions, savings, and money decisions. The product voice must feel warm, practical, and reassuring, never corporate, alarmist, or shame-heavy, because financial tools often sit close to real money anxiety.

## 2. Tech Stack - Exact And Non-Negotiable

Use the stack that exists in this workspace unless the user explicitly approves a migration.

- Web: React 19.1, TypeScript 5.8, Vite 6.4, Tailwind CSS 3.4, PostCSS, Autoprefixer
- Backend: Node.js HTTP server, TypeScript 5.8, `tsx`
- AI: TODO - Gemini 2.5 Flash is planned, but no AI integration exists in the current codebase.
- Database/Auth/Storage: TODO - Supabase is planned, but no `supabase/` folder, migrations, client, or Edge Functions exist yet.
- Mobile: TODO - React Native / Expo is planned, but no mobile app exists yet.
- Monorepo tool: TODO - Turborepo is planned, but the current repo has `frontend/` and `backend/` folders without a root workspace config.

Do not substitute framework choices, add a router, add state/query/form libraries, or introduce a database layer without first checking the existing code and asking when the change affects architecture.

## 3. Folder Structure Map

Current workspace:

```text
backend/
  src/
    config/
    routes/
    services/
frontend/
  src/
    assets/
    components/
    pages/
```

Planned structure from the product brief, not yet implemented:

```text
apps/web/                <!-- TODO: migrate frontend if/when Turborepo is introduced -->
apps/mobile/             <!-- TODO: create Expo app -->
packages/ui/             <!-- TODO: shared UI package -->
packages/types/          <!-- TODO: shared domain types -->
packages/utils/          <!-- TODO: shared formatters and utilities -->
packages/api/            <!-- TODO: shared API client/contracts -->
packages/ai/             <!-- TODO: shared AI prompts/tools -->
packages/i18n/           <!-- TODO: language resources -->
supabase/migrations/     <!-- TODO: database migrations -->
supabase/functions/      <!-- TODO: Edge Functions -->
supabase/seed/           <!-- TODO: seed data -->
docs/                    <!-- TODO: deeper product and engineering docs -->
tests/                   <!-- TODO: tests -->
```

Before creating any new file, check whether it belongs in the current `frontend/` or `backend/` structure. Do not create a new top-level folder unless the request clearly starts that package or the user approves the planned monorepo shape.

## 4. Design System Rules The Agent Must Always Follow

- Current brand colors in code use teal around `#0f8a6b` / `#0f6f57` and warm background `#f8f7f2`.
- Planned token target: brand teal `#0F6E56`, background `#F9F9F7`; TODO - add these to `frontend/tailwind.config.cjs`.
- Do not use pure white as the main page background unless an existing component already does so for contrast.
- Currency is always Philippine Peso. Use `formatCurrency()` once a shared utility exists; TODO - create shared formatter before adding more finance views.
- Typography is currently browser/default Tailwind typography; TODO - confirm Plus Jakarta Sans for headings, Inter for body, and JetBrains Mono for amounts before introducing font assets.
- Prefer Tailwind classes and theme tokens. Avoid scattering one-off colors, spacing, or fonts as the design system matures.

## 5. Data & Security Rules - Hard Constraints

- TODO - when Supabase is added, every user-data table must enable Row Level Security scoped to `auth.uid()`.
- TODO - every new Supabase table migration must include its RLS policy in the same migration.
- Never put `SUPABASE_SERVICE_ROLE_KEY` or any server-only secret in client code.
- Soft delete user financial data. Any future user-data table should include `deleted_at`; never hard-delete financial records unless the user explicitly requests a privacy/delete-account flow.
- Gemini API calls must not include real name, email, auth ID, or account IDs. Send anonymized financial summaries only.

## 6. Required Workflow Before Writing Code

For any feature:

1. Check current files with `rg` before adding new code.
2. Check for existing frontend components in `frontend/src/components`.
3. Check `SKILL.md` before implementing Philippine currency, biller, due-date, document, PDF, spreadsheet, or presentation logic related to Alalay.
4. Run the relevant build/type check before considering the task complete: `npm run build` in `frontend/` and/or `backend/`.
5. Every new user-facing page should include loading, empty, and error states once it depends on async data.

When the planned monorepo exists, also check `packages/types/index.ts` and `packages/ui` before defining new types or components.

## 7. Commit And PR Conventions

- Use conventional commits: `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`.
- Any PR that adds `supabase/migrations` must include matching RLS policies and a rollback note.
- Any PR that changes AI prompts must include a one-line behavior summary because prompt changes affect all user sessions.
- Keep changes tightly scoped. Do not bundle refactors with feature work unless needed for correctness.

## 8. What The Agent Should Never Do

- Never call Meralco, PLDT, Maynilad, Manila Water, Globe, SSS, PhilHealth, Pag-IBIG, GCash, or Maya websites directly from app code.
- Never scrape Philippine biller portals.
- Never assume bank or e-wallet sync exists; treat Open Finance Philippines integration as a future v2.0 item.
- Never invent Gemini, Supabase, mobile, or biller API capabilities not present in the codebase.
- Never add a third-party dependency without checking whether the current stack already solves the problem.
- Never expose server-only secrets in `frontend/`.

## 9. Reference Docs

- [SKILL.md](./SKILL.md)
- `docs/database-schema.md` <!-- TODO: confirm this exists -->
- `docs/api-contracts.md` <!-- TODO: confirm this exists -->
- `docs/design-system.md` <!-- TODO: confirm this exists -->
- `docs/ai-capabilities.md` <!-- TODO: confirm this exists -->
- Figma file link <!-- TODO: add project Figma URL -->
