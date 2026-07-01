# SKILL.md — Philippine Biller & Finance Formatting

This file applies any time an agent is:
- Formatting currency amounts or dates in any component, hook, or service
- Computing or displaying bill due dates for any Philippine biller
- Writing UI copy that references billing, payment, or financial data
- Building any feature that touches Meralco, PLDT, Maynilad, Manila Water, Globe, GCash, Maya, SSS, PhilHealth, or Pag-IBIG
- Deciding what an automated bill-detection or Gmail-sync feature can or cannot do
- Writing Filipino-language or Taglish copy anywhere in the app

---

## Currency formatting (actual implementation)

The shared formatter lives at `frontend/src/utils/formatters.ts`. Use it everywhere — never format currency inline in a component.

### Actual function signature (as implemented)
```typescript
formatCurrency(amount: number, showCentavos?: boolean): string
```

### Rules
- Symbol: `₱` — always prefix, no space: `₱1,240` not `PHP 1,240` or `₱ 1,240`
- Thousands separator: comma — `₱1,240` not `₱1240`
- Centavos: hidden when zero by default (`₱1,240`), shown when `showCentavos=true` or when non-zero (`₱1,240.50`)
- Always call `formatCurrency()` — never use `toLocaleString()`, `Intl.NumberFormat`, or template literals with raw amounts directly in JSX

```typescript
// ✅ correct
formatCurrency(2400)          // → "₱2,400"
formatCurrency(2400.50)       // → "₱2,400.50"
formatCurrency(2400, true)    // → "₱2,400.00"

// ❌ wrong — never do these in components
`₱${amount}`
amount.toLocaleString('en-PH', { style: 'currency', currency: 'PHP' })
```

---

## Date formatting (actual implementation)

Also in `frontend/src/utils/formatters.ts`. Use these — never format dates inline.

### Actual functions (as implemented)
```typescript
formatDateShort(value: string | Date): string    // → "Jun 28"
formatMonthYear(value: string | Date): string    // → "June 2026"
```

### Functions planned but not yet built — implement when needed
```typescript
// Add these to frontend/src/utils/formatters.ts when required:
formatDateFull(value: string | Date): string     // → "June 28, 2026"
formatRelativeDate(value: string | Date): string // → "3 days from now" / "Overdue by 8 days"
daysUntilDue(dueDate: string): number           // → positive = days left, negative = overdue
```

### Stale date hardcodes to fix
The following pages contain hardcoded date strings that must be replaced with dynamic formatters:
- `DashboardPage` — "Saturday, June 28, 2025"
- `BudgetPage` — "June 2025"
- `ReportsPage` — "Q2 2025"
- `HomePage` — "© 2025"

Never hardcode a specific date, month, quarter, or year as a string literal in a component. Always derive from `new Date()` or a data value and format with the utilities above.

---

## Philippine biller facts (confirmed — do not re-investigate)

These facts were confirmed during research. Accept them as true and do not build features that contradict them.

### Meralco
- **Due date rule:** Bill date + 9 days (confirmed via Meralco's official FAQ)
- **Email format:** The Meralco Paperless Billing email is a **notification only** — it contains a link to the Meralco Online portal, NOT the amount or due date in the email body
- **PDF attachment:** Some users receive the bill as a PDF email attachment; others only receive the notification link. This is inconsistent and depends on account configuration — cannot be guaranteed for all users.
- **No public API** — do not attempt to scrape `meralco.com.ph` or any Meralco endpoint
- **Gmail sync capability (honest):**
  - ✅ Can reliably detect that a new bill notification arrived
  - ✅ Can pre-fill the due date using the confirmed +9-day rule
  - ⚠️ Can extract amount only if a PDF is attached (not guaranteed)
  - ❌ Cannot guarantee full automatic extraction for all users
  - **UI copy must say "We'll try to auto-fill your bill" — never promise full automation**

### Maynilad / Manila Water
- **Due date rule:** Typically 15–20 days after bill date, varies by zone
- **Status: UNCONFIRMED** — do not present this as fact in UI copy
- When the due date is unknown, prompt the user to enter it manually
- No public API exists

### PLDT / Globe
- **Due date rule:** Typically 30 days from bill date
- **Status: UNCONFIRMED** — do not present this as fact in UI copy
- When the due date is unknown, prompt the user to enter it manually
- No public API exists

### GCash / Maya
- Used as **payment method values** in the `expenses.payment_method` enum: `'gcash'`, `'maya'`
- These are not billing integrations — Alalay has no access to GCash or Maya transaction history
- Open Finance Philippines (BSP Circular 1122) may enable read-only e-wallet transaction access in future — this is **v2.0 roadmap only, not implemented**
- Do not build any feature that implies GCash/Maya transaction syncing is currently available

### SSS, PhilHealth, Pag-IBIG
- Government contributions — treated as regular recurring bills in Alalay
- Fixed amounts per user's contribution bracket
- No API access — manual entry only

---

## Due date auto-calculation rules

When implementing any "auto-calculate due date" feature:

```typescript
// ✅ SAFE — apply with confidence
if (biller === 'meralco') {
  dueDate = addDays(billDate, 9) // confirmed rule
}

// ⚠️ UNSAFE — do not auto-apply, prompt user instead
if (biller === 'maynilad' || biller === 'pldt' || biller === 'globe') {
  // show a helper label: "Typically due 15–30 days after billing date"
  // but let the user confirm the actual date
}
```

An incorrect auto-calculated due date causes missed payments — it is worse than showing no prediction at all. When in doubt, ask the user.

---

## Gmail bill detection — what is actually true

This feature is on the **v1.1 roadmap** and is not yet implemented. When it is built, the following constraints apply and must be reflected accurately in UI copy, feature flags, and error states.

### What Gmail API can do for Alalay
| Capability | Reliability | Notes |
|---|---|---|
| Detect a new Meralco bill notification arrived | ✅ High | Email sender is known and consistent |
| Pre-fill due date using +9-day rule | ✅ High | Rule is confirmed |
| Extract amount from email body | ❌ None | Amount is not in the email body |
| Extract amount from attached PDF | ⚠️ Medium | Only works if PDF is attached — not guaranteed for all users |

### What Gmail API cannot do
- It cannot access the Meralco Online portal or fetch bill data from it
- It cannot guarantee the PDF is attached — many users only get a notification link
- It cannot scrape the biller website even if given the link

### UI copy rules for this feature
```
✅ "We found a Meralco bill notification in your Gmail. Due date pre-filled."
✅ "We'll try to auto-fill your bill amount from the email — please confirm."
❌ "Your Meralco bill has been automatically imported."
❌ "Alalay fetches your bills directly from Meralco."
```

---

## Biller constants (planned — not yet in codebase)

The following constants were planned in the original design but **do not yet exist** in `frontend/src/constants/`. Create them in `frontend/src/constants/billers.ts` when needed:

```typescript
export const PH_BILLERS = [
  { id: 'meralco',    name: 'Meralco',      category: 'utilities',     dueDaysAfterBill: 9,    confirmed: true  },
  { id: 'pldt',       name: 'PLDT',         category: 'utilities',     dueDaysAfterBill: 30,   confirmed: false },
  { id: 'globe',      name: 'Globe',        category: 'utilities',     dueDaysAfterBill: 30,   confirmed: false },
  { id: 'maynilad',   name: 'Maynilad',     category: 'utilities',     dueDaysAfterBill: null, confirmed: false },
  { id: 'mwss',       name: 'Manila Water', category: 'utilities',     dueDaysAfterBill: null, confirmed: false },
  { id: 'sss',        name: 'SSS',          category: 'government',    dueDaysAfterBill: null, confirmed: false },
  { id: 'philhealth', name: 'PhilHealth',   category: 'government',    dueDaysAfterBill: null, confirmed: false },
  { id: 'pagibig',    name: 'Pag-IBIG',     category: 'government',    dueDaysAfterBill: null, confirmed: false },
  { id: 'netflix',    name: 'Netflix',      category: 'subscriptions', dueDaysAfterBill: 30,   confirmed: false },
  { id: 'spotify',    name: 'Spotify',      category: 'subscriptions', dueDaysAfterBill: 30,   confirmed: false },
] as const

export const EXPENSE_CATEGORIES = [
  { id: 'food',          label: 'Food & dining',    icon: 'UtensilsCrossed', color: '#EA580C' },
  { id: 'transport',     label: 'Transportation',   icon: 'Car',             color: '#2563EB' },
  { id: 'utilities',     label: 'Utilities',        icon: 'Zap',             color: '#0F6E56' },
  { id: 'subscriptions', label: 'Subscriptions',    icon: 'Repeat',          color: '#7C3AED' },
  { id: 'health',        label: 'Health',           icon: 'Heart',           color: '#DB2777' },
  { id: 'housing',       label: 'Housing / rent',   icon: 'Home',            color: '#D97706' },
  { id: 'education',     label: 'Education',        icon: 'GraduationCap',   color: '#0891B2' },
  { id: 'remittance',    label: 'Remittance',       icon: 'Send',            color: '#059669' },
  { id: 'savings',       label: 'Savings',          icon: 'PiggyBank',       color: '#0F6E56' },
  { id: 'others',        label: 'Others',           icon: 'MoreHorizontal',  color: '#6B7280' },
] as const
```

The `confirmed: true/false` field on billers is important — only apply due-date auto-calculation for billers where `confirmed: true`.

---

## Language and tone rules

### Language detection
The app supports English and Filipino (Tagalog). The user's language preference is stored in `users.language` as `'en'` or `'fil'`. UI copy is currently written in English only — Filipino support is planned but not yet implemented.

### Tone rules (apply to all copy — labels, empty states, error messages, AI responses)
- Warm and direct — like a trusted friend who knows your finances
- Natural code-switching is encouraged in AI responses and notification copy: "Kaya mo yan!" / "Maganda ang progress mo!"
- Never stiff, formal Filipino — conversational register only
- Never ALL CAPS for emphasis
- Never corporate filler: "kindly note", "please be advised", "as per"
- Overdue bill tone: firm but not alarming — "This bill is overdue. Tap to mark as paid or update the amount."
- Encouraging tone for savings: "You're 48% of the way there! ₱X more to go."

### Copy examples by context
```
Empty state (no bills):
  ✅ "Wala pang bills. Add your first one to start tracking."
  ❌ "No records found."

Overdue bill:
  ✅ "Your Manila Water bill is 8 days overdue. Mark as paid?"
  ❌ "OVERDUE: Payment required immediately."

AI assistant not configured:
  ✅ "Alalay AI is almost ready. We're setting things up — check back soon."
  ❌ "AI Status: not_configured" (never show a raw status string to the user)

Savings progress:
  ✅ "₱12,000 of ₱25,000 — you're almost halfway! Keep it up."
  ❌ "Progress: 48%"
```

---

## Financial health score formula

When implementing or updating `healthScore.service.ts` in the backend:

```
Health Score (0–100) =
  On-time payments     35%   (bills paid on or before due_date / total bills, rolling 3 months)
  Savings rate         25%   (total saved this month / monthly income)
  Subscription ratio   20%   (total subscriptions / income — penalize if > 15% of income)
  Budget adherence     20%   (1 - (overspend / budget) — 0 if no budget set)

Score bands:
  80–100  Excellent
  60–79   Good
  40–59   Fair
  0–39    Needs attention
```

The score is computed on the backend in `backend/src/services/` and stored in `users.health_score`. It should be recomputed on a schedule (weekly) and also on demand when significant financial events occur (bill marked paid, new expense logged).