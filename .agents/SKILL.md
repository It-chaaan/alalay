# Alalay Development Skill

## Purpose

Use this guide for all future work in Alalay. It reflects the current implementation and defines how changes should be made without fighting the existing architecture.

## Core responsibilities

The AI should help with:

- feature implementation
- bug fixing
- refactoring
- Supabase schema changes
- backend API work
- OCR-related frontend work
- AI assistant improvements
- financial logic updates
- reporting and analytics changes
- UI and UX polish
- performance and security hardening

## Required context awareness

Before changing code, understand these current facts:

- Frontend is React 19 + TypeScript + Vite.
- Routing is manual in `frontend/src/App.tsx`, not React Router.
- Shared data hooks already exist:
  - `frontend/src/hooks/useApiQuery.ts`
  - `frontend/src/hooks/useApiMutation.ts`
- API requests go through `frontend/src/lib/api.ts`.
- Backend is Express + TypeScript.
- Supabase is the database and auth provider.
- AI assistant backend already exists and uses Google Gemini Flash.
- OCR already exists, but it is browser-side through `tesseract.js`.
- Current AI docs live in `.agents/`.

## Development workflow

Before making changes:

1. Inspect the relevant feature path first.
2. Reuse existing hooks, services, and utilities where possible.
3. Check for an existing backend route or service before adding a new one.
4. Preserve backwards compatibility unless the task explicitly allows breaking changes.
5. Update documentation when architecture, schema, or workflows change.

Do not rewrite stable code just to introduce a different pattern.

## Implementation rules

### Frontend rules

- Keep using the existing manual routing model unless the project explicitly migrates routing.
- Only parse markdown for assistant-generated content, not ordinary user input.
- Reuse existing layout and dashboard shell components.
- Prefer extending current page modules over duplicating similar pages.
- Keep styling aligned with current Tailwind usage and shared CSS patterns.
- Avoid introducing a second state or data fetching framework.

### Backend rules

- Put business logic in services, not directly in route handlers.
- Validate request payloads with Zod at API boundaries.
- Reuse the current auth middleware and Supabase client setup.
- Keep route contracts stable unless the user explicitly requests an API change.

### Database rules

- All schema changes must go through `supabase/migrations/`.
- Respect RLS assumptions in every query or mutation.
- Do not move privileged operations into the frontend.
- Regenerate or update types when schema changes affect frontend data contracts.
- Keep Supabase schema and API expectations aligned. If a frontend field is added, verify the column exists in migrations and in the live project.

## Financial intelligence rules

Understand these relationships before changing finance logic:

- income feeds budget capacity and report summaries
- expenses reduce budget headroom and affect analytics
- bills and subscriptions are recurring obligations with due dates
- savings goals compete with discretionary spending and budget allocations
- reports aggregate cross-feature financial data
- analytics should not recompute the same business rule differently in multiple places

Most non-trivial finance calculations should live in backend services, especially analytics and reporting paths. Frontend calculations should be limited to presentation-only derivations.

Do not introduce new formulas that conflict with current backend summaries without updating the backend source of truth.

## AI assistant rules

AI functionality exists today.

Current implementation:

- provider: Google Gemini Flash
- backend services:
  - `backend/src/services/ai.service.ts`
  - `backend/src/services/ai.providers.ts`
  - `backend/src/services/ai.context.service.ts`
- routes:
  - `GET /api/ai/status`
  - `POST /api/ai/chat`
  - `POST /api/ai/chat/stream`
- frontend hook: `frontend/src/hooks/useAiAssistant.ts`
- frontend page: `frontend/src/pages/dashboard/AiAssistantPage.tsx`

Rules:

- Keep prompt/context construction in the backend.
- Do not move API keys or model calls into the client.
- Preserve markdown-capable assistant rendering in the UI.
- If conversation persistence changes, document whether history remains local-only or becomes server-backed.

## OCR rules

OCR functionality exists today, but the current implementation is frontend-side.

Current implementation:

- page: `frontend/src/pages/dashboard/OcrScannerPage.tsx`
- engine: `tesseract.js`
- backend OCR routes currently provide capability/demo support only

Rules:

- Do not document OCR as a backend document-processing pipeline unless it is actually implemented.
- If extraction logic becomes server-side later, update `.agents/Agents.md`, this file, and `README.md`.

## Settings and persistence rules

Settings are split across backend-backed and local-only storage.

Current persistence caveats from the codebase:

- some profile data is backend-backed
- some app preferences are stored in `localStorage`
- AI chat history is stored locally in the frontend
- some security/UI toggles such as 2FA state are currently UI/local-state oriented

Do not assume every setting already has durable backend persistence.

## Security rules

- Never expose `SUPABASE_SERVICE_ROLE_KEY`.
- Never expose `GEMINI_API_KEY`.
- Never bypass authentication on protected API routes.
- Always respect RLS.
- Treat financial records, AI history, and Gmail connection data as sensitive.

## Documentation synchronization rules

Whenever any of the following changes:

- database schema
- backend APIs
- frontend architecture
- AI provider or response pipeline
- OCR architecture
- financial logic
- authentication flow

update all relevant docs so they stay synchronized:

- `.agents/Agents.md`
- `.agents/SKILL.md`
- `README.md`

Documentation is part of the implementation. Do not leave it stale.
