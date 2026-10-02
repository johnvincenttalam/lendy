# Money Tracker (Income & Expenses) — Design

## Goal

A simple personal ledger that answers "where does my money go?". Entirely
separate from loans, bills, savings and the financial health score.

## Scope

**In:** one-off income and expense entries, preset + custom categories, a
monthly summary with a per-category expense breakdown, backup/restore support.

**Out (YAGNI):** recurring entries, budgets, search, linking to loans/bills,
changes to the existing `monthlyIncome` setting or health score, a bottom-nav
tab, bank sync.

## Decisions (agreed with the user)

- Income is entered as one-off transactions, same as expenses.
- Categories: built-in presets plus user-defined custom categories.
- Placement: a "Money" page reached from the More tab; bottom nav unchanged.
- Data is independent of loans/bills/savings.

## Data and storage

New folder `src/features/money/`:

- `moneyTypes.ts` — types below.
- `moneyStore.ts` — zustand store persisted to localStorage, written in the
  style of `savingsStore.ts` (try/catch on load, `importBackup`).
- `moneyUtils.ts` — pure helpers (monthly totals, category breakdown).
- `moneyIcons.ts` — icon map for categories, modelled on `billIcons.ts`.

```ts
type MoneyEntryType = 'income' | 'expense'

type MoneyCategory = {
  id: string
  type: MoneyEntryType   // a category belongs to exactly one type
  name: string
  icon: string           // key into the icon map
  builtIn: boolean
}

type MoneyEntry = {
  id: string
  type: MoneyEntryType
  amount: number         // > 0; sign is implied by type
  categoryId: string
  date: string           // ISO date (YYYY-MM-DD)
  note?: string
  createdAt: string
}
```

**Built-in categories** (seeded on first load, cannot be deleted):
- Expense: Food, Transport, Shopping, Health, Entertainment, Education, Other
- Income: Salary, Business, Gift, Other

**Custom categories:** user supplies a name and picks an icon from the small
icon set. Can be renamed or deleted. Built-ins are shown but locked.

**Deleting a custom category:** its entries are reassigned to that type's
"Other" built-in category. No entry is ever orphaned or deleted.

**localStorage keys:** `loan-tracker-money-entries`,
`loan-tracker-money-categories`.

**Backup (`src/utils/backup.ts`):**
- `exportAllData` adds `moneyEntries` and `moneyCategories`.
- `importAllData` restores them when present. They are optional: older backups
  without them still restore, leaving existing money data untouched (a
  loans-only old backup must not wipe the ledger).
- The restore confirmation counts mention entries when present.

## Screens

**Routing:** new `/money` route in `App.tsx`. New "Money" row on `MorePage`
(Wallet icon, "Track income and expenses").

**Money page** (header uses `BRAND_GRADIENT`), top to bottom:

1. Header: month with prev/next arrows (default current month); net amount
   (income − expenses) as the large number; small "₱X income" (green) and
   "₱Y spent" (red) beneath, matching the Bills header style.
2. "Where it went": that month's expenses by category as a horizontal bar
   list (icon, name, amount, % of total), largest first. Empty state:
   "No expenses this month".
3. Filter chips: All / Income / Expenses.
4. Entries list for the month, grouped by day, newest first. Row: category
   icon, category name, optional note, amount (green `+` income, normal `−`
   expense). Tap to edit.

**Add / edit:** a "+" button on the page opens a bottom-sheet form styled like
the existing bill/savings forms: Expense/Income toggle (default Expense),
amount, category chips for the chosen type with a "+ New" chip for inline
custom-category creation, date (default today), optional note. Edit mode adds
a Delete button. The global bottom-nav Add button is not changed.

**Manage categories:** a link on the Money page lists custom categories for
rename/delete. Delete confirms with "Entries will move to Other".

## Edge cases and validation

- Amount must be > 0.
- Future dates allowed.
- Months with no entries show an empty state with an "Add your first entry"
  prompt.
- Amounts use the app's existing peso formatter.
- Category names: trimmed, non-empty, unique within a type (case-insensitive).

## Testing

Unit tests (`moneyUtils.test.ts`, following existing `*.test.ts` conventions):
monthly income/expense/net totals, category breakdown ordering and
percentages, month boundaries, delete-category reassignment to "Other", and a
backup round-trip including an old backup that lacks money data. UI is
verified by running the app.
