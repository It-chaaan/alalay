# Alalay Development Skill

Use this for feature work, bug fixes, refactors, Supabase changes, analytics, AI/OCR work, and UI polish.

## Workflow

1. Inspect the relevant page, hook, backend route/service, and migration.
2. Check `git status` and preserve unrelated changes.
3. Reuse `frontend/src/lib/supabase.ts`, `apiClient.ts`, existing hooks, and shared layout components.
4. Cross-check env names against both `.env.example` files and `backend/src/config/env.ts`.
5. Run relevant frontend/backend builds and update project docs when architecture, auth, schema, API, analytics, AI, OCR, or theme behavior changes.

## Auth rules

- Supabase Auth supports email/password and Google OAuth; OAuth uses `/auth/callback` and the current client relies on the default implicit flow.
- Do not manually create Google users. Supabase creates/matches the auth user and the profile trigger creates `public.users`.
- Google-only accounts use the Settings “Set a password” state; detect email identities/providers or `user_metadata.password_set`, update password plus the marker, and refresh session state.
- MFA is authenticator-app TOTP, not email/SMS. Use verified `totp` factors and `mfa.challengeAndVerify`.
- Trust-device is not complete: the checkbox has no durable token, hashing, revocation, or backend enforcement.
- Guide Google-only login failures to Google sign-in or Settings → Set a password.

## Theme/accessibility rules

- Respect Light/Dark/System via `AppPreferencesContext` and the root `dark` class.
- Prefer existing Tailwind surface/text classes and provide `dark:` variants for custom UI. Never add light-only cards, banners, inputs, alerts, toasts, badges, or empty states.
- Use high-contrast shared shell title/subtitle styles and preserve visible focus states and practical WCAG AA contrast.

## Data rules

- Keep business calculations in backend services, especially analytics/reporting.
- Use `Asia/Manila` date-only boundaries for finance summaries unless product requirements change.
- Return dynamic chart current markers; do not hardcode month labels.
- Distinguish loading, successful-empty, and error states; never turn failed queries into `₱0` or blank content.
- Use migrations for schema/index/trigger changes and preserve RLS/backend auth.

## AI/OCR rules

- Gemini chat is backend-only through `/api/ai/status`, `/api/ai/chat`, and `/api/ai/chat/stream`; never expose keys or move prompts/data calls to the client.
- The dashboard AI card remains a placeholder and must not be given fake text. Define data, prompt contract, endpoint, refresh, caching, and error behavior before wiring it.
- OCR currently runs in-browser with `tesseract.js`; do not describe it as a backend extraction pipeline.

## Profile/avatar rules

- Scope local profile storage by Supabase user ID (`alalay-profile:<userId>`).
- Use Google provider metadata when available; otherwise use neutral initials. Never reuse a global cached photo.
- Keep avatar uniqueness/repair logic in migrations and never use service-role credentials in the browser.

## Validation

- Run the relevant builds.
- Test dates near timezone/month boundaries and assert current markers change.
- Verify email/password, Google callback, Google-only password setup, and TOTP paths separately.
- Report unavailable browser/provider/production checks honestly and mark incomplete features as partial or needing verification.
