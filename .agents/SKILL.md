# Alalay Filipino Biller & Finance Formatting Skill

Use this skill any time work touches Philippine Peso amounts, financial summaries, due dates, Philippine billers, local payment channels, OCR bill extraction, receipt parsing, or UI copy about bill automation for Alalay.

## Currency Formatting Rules

- Always use the peso symbol with no space: `PHP 1240` and `P 1,240` are wrong; `₱1,240` is right.
- Use comma thousands separators.
- Show centavos only when non-zero: `₱1,240`, `₱1,240.50`.
- Use a shared `formatCurrency(amount, showCentavos?)` utility once it exists. TODO - create it in a shared utility location before adding more finance screens.
- Do not format currency inline with raw `toLocaleString` inside React components.

## Date Formatting Rules

- Short format: `Jun 28`
- Full format: `June 28, 2026`
- Relative format: `3 days from now`, `Overdue by 8 days`
- Use shared date formatters once they exist. TODO - create `formatters.ts` in a shared utility location.
- Do not format bill dates inline inside components when a shared formatter exists.

## Known Philippine Biller Due-Date Rules

```text
CONFIRMED:
  Meralco - due date = bill date + 9 days (confirmed via Meralco official FAQ)

UNCONFIRMED - treat as estimate only, do not present as fact in UI copy:
  Maynilad / Manila Water - typically 15-20 days, varies by zone, needs verification
  PLDT - typically 30 days from bill date, needs verification
  Globe - typically 30 days from bill date, needs verification

RULE FOR THE AGENT:
  When implementing auto-calculate due dates, only apply the fixed +9 day
  Meralco rule with confidence. For all other billers, ask the user for the
  due date directly instead of guessing. An incorrect predicted due date is
  worse than no prediction.
```

## Bill Data Fetching Reality

- No Philippine biller in scope has a public API for direct consumer bill fetching.
- Direct automated fetching from biller portals is not possible and must not be promised.
- Meralco Paperless Billing email is usually a notification with a portal link; amount and due date may not be in the email body.
- Future Gmail integration can reliably detect bill notifications, but full extraction depends on email content and attachments.
- If PDF attachments exist, OCR or PDF parsing may pre-fill amount and due date for some users.
- UI copy should say "we'll try to auto-fill" or similar. Never promise complete automation.
- OCR receipt/bill scanning is the more reliable automated path when the user photographs or uploads the document directly.

## Local Biller Reference Data

```ts
export const PH_BILLERS = [
  { name: "Meralco", category: "electricity", type: "utility" },
  { name: "PLDT", category: "internet", type: "telco" },
  { name: "Globe", category: "mobile", type: "telco" },
  { name: "Manila Water", category: "water", type: "utility" },
  { name: "MWSS", category: "water", type: "utility" },
  { name: "SSS", category: "government", type: "government" },
  { name: "PhilHealth", category: "government", type: "government" },
  { name: "Pag-IBIG", category: "government", type: "government" },
  { name: "Netflix", category: "subscription", type: "subscription" },
  { name: "Spotify", category: "subscription", type: "subscription" },
  { name: "GCash", category: "wallet", type: "payment" },
] as const;
```

Use this list for onboarding suggestions and bill-category defaults. Treat it as reference data, not a complete national biller database.

## Language And Tone Rules

- Support English, Filipino, and natural Taglish code-switching.
- Mirror the user's language choice.
- Use natural conversational Filipino; avoid stiff or overly formal phrasing.
- Never use all caps for emphasis.
- Avoid corporate phrases such as "kindly note" or "dear valued customer."
- Be calm and direct when discussing debt, overdue bills, or low balances. Do not shame the user.
