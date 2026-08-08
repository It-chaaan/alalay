# Alalay Development Skill

Use this for feature work, bug fixes, refactors, Supabase changes, analytics, AI/OCR work, and UI polish.

## Workflow

1. Identify the scope first: web (`frontend/`), mobile (`mobile/`), backend (`backend/`), or shared infrastructure (`supabase/`, shared API/contracts).
2. Inspect the relevant client screen, hook, backend route/service, and migration.
3. Check `git status` and preserve unrelated changes.
4. For web work, reuse the existing `frontend/` Supabase client, API client, hooks, Tailwind/CSS, and layout components.
5. For mobile work, inspect and reuse the patterns already established in `mobile/` (Expo Router, StyleSheet palettes, Expo/native packages, and SecureStore auth). Do not copy Vite, browser APIs, Tailwind/CSS, localStorage, browser OCR, or web routing patterns blindly into React Native.
6. For backend/shared work, consider both clients and preserve the single backend, Supabase project, schema, RLS policy, and API contract.
7. Cross-check env names against the relevant `.env.example` files and `backend/src/config/env.ts`.
8. Run relevant client/backend builds and update the relevant project docs when architecture, auth, schema, API, analytics, AI, OCR, theme behavior, or client structure changes.

## Auth rules

- Supabase Auth supports email/password and Google OAuth; OAuth uses `/auth/callback` and the current client relies on the default implicit flow.
- Do not manually create Google users. Supabase creates/matches the auth user and the profile trigger creates `public.users`.
- Google-only accounts use the Settings “Set a password” state; detect email identities/providers or `user_metadata.password_set`, update password plus the marker, and refresh session state.
- MFA is authenticator-app TOTP, not email/SMS. Use verified `totp` factors and `mfa.challengeAndVerify`.
- Trust-device is not complete: the checkbox has no durable token, hashing, revocation, or backend enforcement.
- Guide Google-only login failures to Google sign-in or Settings → Set a password.
- Web uses the existing browser Supabase flow; mobile uses its native client and PKCE/deep-link flow. Verify the client-specific implementation before changing OAuth.

## Theme/accessibility rules

- For web, respect Light/Dark/System via `AppPreferencesContext` and the root `dark` class. For mobile, inspect its own provider/hooks and palette; the current checked-in product intentionally forces light mode and does not yet expose persisted theme settings.
- Prefer existing web Tailwind surface/text classes or mobile StyleSheet palette tokens, with both-mode handling where that client supports it. Never add light-only cards, banners, inputs, alerts, toasts, badges, or empty states to a client that supports dark mode.
- Use high-contrast shared shell title/subtitle styles and preserve visible focus states and practical WCAG AA contrast.
- Report charts need keyboard-reachable value tooltips, and budget indicators must pair color with labels or values.

## Data rules

- Keep business calculations in backend services, especially analytics/reporting.
- Use `Asia/Manila` date-only boundaries for finance summaries unless product requirements change.
- Report totals and breakdowns must use the same spending dataset; chart values must not be visually rescaled in a way that contradicts their labels.
- Return dynamic chart current markers; do not hardcode month labels.
- Distinguish loading, successful-empty, and error states; never turn failed queries into `₱0` or blank content.
- Use migrations for schema/index/trigger changes and preserve RLS/backend auth.

## AI/OCR rules

- Gemini chat is backend-only through `/api/ai/status`, `/api/ai/chat`, and `/api/ai/chat/stream`; never expose keys or move prompts/data calls to the client.
- The dashboard AI card remains a placeholder and must not be given fake text. Define data, prompt contract, endpoint, refresh, caching, and error behavior before wiring it.
- OCR currently runs in-browser with `tesseract.js`; do not describe it as a backend extraction pipeline.
- Mobile OCR is not currently implemented and requires a React Native-compatible approach; do not copy the browser/WASM implementation into `mobile/`.

## Profile/avatar rules

- Scope local profile storage by Supabase user ID (`alalay-profile:<userId>`).
- Use Google provider metadata when available; otherwise use neutral initials. Never reuse a global cached photo.
- Keep avatar uniqueness/repair logic in migrations and never use service-role credentials in the browser.

## Validation

- Run the relevant builds.
- Test dates near timezone/month boundaries and assert current markers change.
- Verify email/password, Google callback, Google-only password setup, and TOTP paths separately.
- Report unavailable browser/provider/production checks honestly and mark incomplete features as partial or needing verification.
