# Alalay Mobile Development Skill

Use this for feature work, bug fixes, refactors, Supabase-backed changes, analytics display, AI/OCR work, and UI polish on the React Native (Expo) mobile app.

## Workflow

1. Inspect the relevant screen, navigation route, shared hook, backend route/service, and migration (backend/database are shared with web — check the web repo's state before assuming a schema or endpoint shape).
2. Check `git status` and preserve unrelated changes.
3. Reuse the shared API client, ported data-fetching hooks, and existing shared layout/component patterns already established in the mobile app — do not introduce a second parallel pattern for the same job.
4. Cross-check env variable names against `.env.example` (mobile) and the Expo app config — remember mobile uses `EXPO_PUBLIC_` prefixes, not `VITE_`.
5. Run the relevant mobile build/typecheck (e.g. `npx tsc --noEmit`, `expo prebuild`/`eas build` dry checks as applicable) and update project docs (`AGENTS.md`, `SKILL.md`, `README.md`) when architecture, auth, navigation, AI, OCR, or theming behavior changes.

## Finance form component rule

Finance add flows should reuse `src/components/finance-form.tsx` for the custom amount keypad, category/payment chips, calendar picker, and keyboard-avoiding sheet. Keep the shared component as the single interaction pattern for bills, subscriptions, and expenses.

## Auth rules

- Supabase Auth supports email/password and Google OAuth, same as web, but the mobile OAuth flow uses a deep-link-based redirect (via `expo-auth-session` or Supabase's native OAuth pattern), not the web app's browser `/auth/callback` implicit flow. Do not assume the web OAuth implementation can be copied as-is.
- The current mobile auth screen is `app/auth.tsx`; it uses the platform-aware Supabase client in `src/services/supabase.ts`, with SecureStore-backed native persistence and guarded `localStorage` persistence for Expo web preview, plus Google PKCE through Expo WebBrowser/deep linking.
- Do not manually create Google users — same rule as web; Supabase creates/matches the auth user and the profile trigger creates `public.users`.
- Google-only accounts need an equivalent "Set a password" screen in mobile Settings, using the same detection logic as web (email identities/providers, `user_metadata.password_set`).
- MFA is authenticator-app TOTP, not email/SMS, matching web. Use verified `totp` factors and `mfa.challengeAndVerify`.
- Trust-device is not a complete feature on web (no durable token, hashing, revocation, or backend enforcement) — do not build a mobile trust-device feature that implies stronger guarantees than the shared backend currently provides.
- Guide Google-only login failures to Google sign-in or Settings → Set a password, same as web's messaging pattern.
- Native session persistence must use secure on-device storage (`expo-secure-store` or the project's established equivalent) — never plain `AsyncStorage` for tokens, and never an in-memory-only session that resets on app restart. Expo web preview's guarded `localStorage` fallback is intentionally limited to browser preview and carries XSS risk.

## Theme/accessibility rules

- `src/theme/theme.tsx` is the single mobile appearance source. Use `useAppTheme()` for resolved theme and semantic colors; keep the `system` preference distinct from its current resolved light/dark value.
- Use a single consistent styling approach (NativeWind or StyleSheet-based design tokens, matching whatever the project has already established) with explicit light/dark variants for every custom UI element. Never ship a light-only card, banner, input, alert, toast, badge, or empty state.
- Maintain visible focus/pressed states for every interactive element and practical WCAG AA contrast in both themes. On mobile, also confirm minimum touch target sizes (44×44pt iOS / 48×48dp Android) are respected — this has no direct web equivalent and needs its own check.

Budget editing is month-scoped: use the selected `YYYY-MM` when reading or saving the shared budget plan, and keep over-budget states legible with both color and text.

## Data rules

- Keep business calculations in backend services, same as web — the mobile client renders server results and does only UI-level formatting, never re-derives financial totals client-side.
- Use `Asia/Manila` date-only boundaries for finance summaries, matching web, regardless of the device's actual system timezone (mobile devices are more likely than desktops to have a genuinely different local timezone if the user is traveling — do not assume device timezone equals Philippine time).
- Report totals and breakdowns must use the same spending dataset as what the backend returns; don't visually rescale chart values in a way that contradicts their labels.
- Return dynamic chart current markers from the backend; do not hardcode month/date labels client-side.
- Distinguish loading, successful-empty, and error states explicitly in every screen; never turn a failed request into a silent ₱0 or blank screen — mobile users are more likely to be on unreliable network connections than web users, so this matters more here, not less.
- Bill payments must send an owned wallet ID and Manila-local payment date through the shared finance mutation service; successful mutations publish the shared refresh notification instead of relying on local status changes.
- Use migrations (in the shared repo) for schema/index/trigger changes and preserve RLS/backend auth — mobile never gets its own divergent schema path.

## AI/OCR rules

Loan/debt totals come from the shared `/api/loans` contract. Respect the persisted balance-visibility preference and never classify loan principal as client-side income or spending.

For Home Upcoming, use the shared compact `StatusBadge` treatment and semantic tokens. Keep status derivation separate from financial writes: paid overrides overdue, followed by due today, due soon (three Manila calendar days), and upcoming.

Bill-card statuses are informational compact markings; do not confuse them with the interactive bill filter controls. Preserve the existing filter semantics when changing status visuals.

Loans & Debt is a Wallets drill-down, not a new bottom-navigation destination. Use `FinanceFormSheet`, `WalletPicker`, shared privacy state, and the authenticated `/api/loans` contract for direction-aware creation and split repayments.

Ask Alalay financial actions remain backend-only tool calls with server-side wallet ownership resolution, existing domain-service validation, and request-ID deduplication. Publish `notifyFinancialMutation()` only when the backend reports a successful mutation.

- Gemini chat is backend-only through `/api/ai/status`, `/api/ai/chat`, and `/api/ai/chat/stream`, same as web — never expose keys or move prompts/data calls to the mobile client.
- The dashboard AI card must not show fake/placeholder text dressed up as a real insight, matching the web app's rule — if the mobile AI card isn't wired to real data yet, treat it as a visible placeholder state, not filler copy.
- OCR does **not** carry over from web as-is. `tesseract.js` is a browser/WASM library and isn't a valid mobile solution. Before implementing, decide and document whether mobile OCR uses an on-device native OCR library or sends captures to a (new) backend OCR endpoint — do not silently assume either approach without confirming it in `AGENTS.md` first.
- Mobile receipt OCR uses Expo Camera or Image Picker for capture/selection, then sends the image to the authenticated `/api/ocr/receipt` multipart endpoint. Node owns `tesseract.js`; Expo never bundles OCR. The response is a candidate for review only, and the existing expense API remains the sole financial-write path.
- Receipt images are not retained: the backend uses bounded in-memory upload buffers and does not create Storage objects or OCR records. Test Expo Go using a device-reachable `EXPO_PUBLIC_API_URL`, not `localhost`.

## Profile/avatar rules

- Scope local profile storage by Supabase user ID, same principle as web (`alalay-profile:<userId>` pattern), but using secure/appropriate on-device storage rather than assuming a browser-equivalent key-value store.
- Use Google provider metadata when available; otherwise use neutral initials, matching web. Never reuse a globally cached photo across accounts.
- Keep avatar uniqueness/repair logic in shared migrations; never embed service-role credentials in the mobile app.

- Current profile reads and updates use the shared authenticated `/api/users/me` contract. Do not add `/api/settings/me` client routes or an unscoped profile cache.

## Design taste rules (Emil Kowalski–inspired)

These rules exist to push mobile UI work past "functionally correct" toward genuinely well-considered, cared-about interface design — the kind of attention to detail associated with designers like Emil Kowalski (creator of Sonner, Vaul, and other widely-used interaction-focused components). Apply these whenever building or reviewing any mobile screen, not just when explicitly asked for "polish."

### Motion has to earn its place
- Animate state changes, not decoration. Every transition should communicate something (an item appearing, a value changing, a screen relationship) — don't add motion just because it's easy to add.
- Match easing to physical intuition: elements entering the screen should generally ease out (fast start, gentle stop); elements leaving should ease in (gentle start, fast exit). Avoid linear easing for anything meant to feel natural.
- Duration should scale with distance/size — a small icon state change should be quick (~120–180ms); a full-screen transition or larger sheet/modal can run longer (~250–350ms). Don't use one flat duration for everything in the app.
- Prefer spring-based animations for anything the user can interact with directly (drag-to-dismiss sheets, swipeable rows, pull-to-refresh) — spring physics feel responsive to interruption in a way fixed-duration easing curves don't.
- Every animation must be interruptible. If a user taps/drags mid-animation, the UI should respond immediately from its current position, not queue up or ignore the input until the animation finishes.

### Every state deserves real design attention, not just the happy path
- Loading, empty, error, and success states are not afterthoughts — design each one with the same care as the primary content state. A skeleton loader, a genuinely helpful empty state (with a clear next action, not just "No data"), and a specific, actionable error message all matter as much as the fully-loaded screen.
- Test with realistic data, not placeholder/lorem-ipsum content: long biller names, large peso amounts with many digits, a user with zero bills vs. a user with forty, a very long AI insight paragraph vs. a one-liner. Layouts that only work for "nice" sample data aren't finished.
- Test edge cases specific to mobile: very long text that must truncate/wrap gracefully, small screens (SE-sized) vs. large screens (Pro Max/tablet), one-handed reachability for primary actions.

### Spacing, alignment, and consistency
- Use a single consistent spacing scale (e.g. 4/8/12/16/24/32) throughout the app — don't introduce arbitrary one-off pixel/point values per screen.
- Align optically, not just mathematically — icons, text baselines, and touch targets sometimes need small manual nudges (1–2px) to *look* aligned even when their bounding boxes are technically aligned, especially with rounded shapes or asymmetric glyphs.
- Keep a limited, deliberate type scale (a handful of sizes/weights used consistently for their role — heading, body, caption, label) rather than picking a new font size for each new piece of text as it's built.
- Respect platform convention where it matters (iOS vs. Android navigation patterns, back gesture behavior, action sheet vs. bottom sheet idioms) rather than forcing one platform's patterns onto the other purely for codebase simplicity.

### Restraint over decoration
- Prefer subtle, functional visual cues (borders, slight elevation, spacing) over heavy shadows, gradients, or effects added purely for visual interest. If a shadow or effect doesn't communicate hierarchy or state, question whether it's needed.
- Reduce before adding. When a screen feels cluttered or busy, the fix is usually removing or consolidating elements, not adding more structure (borders, dividers, background colors) to organize them.
- Microcopy matters — button labels, empty-state text, and error messages should be specific and human ("Add your first bill to see it here" beats "No data"), not generic templated copy.

### Iteration and self-review
- After building a screen, deliberately review it against this checklist before considering it done: Does every interactive element have a pressed/active state? Does every async action have a loading state? Does every list have a genuine empty state? Is spacing consistent with the rest of the app? Would this still look intentional with unusually long or unusually short real data?
- When something feels "almost right but off," the cause is very often spacing, alignment, or timing — not color or content. Check those first before reaching for a bigger redesign.
- Prefer showing a before/after or brief description of what changed when reporting UI work, so design decisions are visible and reviewable, not just asserted as done.

## Mobile MFA flow

- For mobile TOTP, use `getMfaState()`/`requiresMfa()` and the SecureStore-backed trusted-device service. Never gate every app launch on factor enrollment alone; distinguish a verified restored session from a pending AAL2 challenge.

## Validation

- Run the relevant mobile build/typecheck.
- Test on both a small-screen and large-screen simulator/device, and on both iOS and Android where feasible, not just one platform.
- Test dates near timezone/month boundaries (Asia/Manila) and assert dynamic markers change correctly, same discipline as web.
- Verify email/password, Google OAuth deep-link callback, Google-only password setup, and TOTP paths separately — each has a genuinely different flow on mobile than web and needs its own check.
- Report unavailable device/simulator/build checks honestly, and mark incomplete features as partial or needing verification rather than reporting them as done.

Ask Alalay sends validated camelCase `pendingAction` state to the shared `/api/ai/chat` contract. Chat rendering must use the centralized safe error mapper; never render `Error.message`, backend bodies, provider payloads, or raw validation details directly as assistant content.
