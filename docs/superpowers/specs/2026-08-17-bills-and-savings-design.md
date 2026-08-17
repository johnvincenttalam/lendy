# Monthly bills & savings tracking

## Purpose

Lendy currently only tracks loan debt. The user also wants to track two more things so they can budget: **recurring monthly bills** (rent, utilities, subscriptions — money that goes out every month with no payoff date, unlike a loan) and **savings goals** (money set aside toward a target, e.g. an emergency fund). Both get their own page, reachable from a new "More" menu since the bottom nav is already full.

Bills and Savings are independent features (separate data, separate pages) built in one pass since they share the same patterns already established by Loans (Zustand store + localStorage, card list → detail page, mark-a-transaction).

## Data model & storage

Two new stores, same shape as `loanStore.ts` (localStorage-persisted Zustand, no backend).

**`src/features/bills/billTypes.ts`**
```ts
export type Bill = {
  id: string
  name: string
  color: string
  category: string // one of BILL_CATEGORIES
  amount: number
  nextDueDate: string // ISO date — the next unpaid cycle
  notes?: string
  createdAt: string
  archived?: boolean
}

export type BillPaymentRecord = {
  id: string
  billId: string
  amount: number
  paidAt: string   // ISO datetime, when marked paid
  dueDate: string   // ISO date, the cycle this payment covered
}

export type BillFormData = Omit<Bill, 'id' | 'createdAt'>

export const BILL_CATEGORIES = [
  'Rent', 'Utilities', 'Internet/Phone', 'Subscription', 'Insurance', 'Transportation', 'Other',
] as const
```
Color picker and palette are reused as-is from loans (`LOAN_COLORS` in `loanTypes.ts`, `ColorPicker.tsx`) — it's a generic color palette, not loan-specific, so no rename/duplication needed.

**`src/features/savings/savingsTypes.ts`**
```ts
export type SavingsGoal = {
  id: string
  name: string
  color: string
  targetAmount: number
  currentAmount: number
  notes?: string
  createdAt: string
  archived?: boolean
}

export type SavingsTransaction = {
  id: string
  goalId: string
  type: 'deposit' | 'withdrawal'
  amount: number
  note?: string
  createdAt: string
}

export type SavingsGoalFormData = Pick<SavingsGoal, 'name' | 'color' | 'targetAmount' | 'notes'>
```

**Storage keys** (new, prefixed to match existing convention): `loan-tracker-bills`, `loan-tracker-bill-payments`, `loan-tracker-savings-goals`, `loan-tracker-savings-transactions`.

## Bills feature

**New files:** `src/features/bills/{billTypes.ts, billUtils.ts, billStore.ts, BillCard.tsx, BillForm.tsx, BillDetails.tsx}`, `src/pages/{BillsPage.tsx, BillDetailsPage.tsx}`

**`billUtils.ts`** — mirrors `loanUtils.ts` patterns, reusing `formatCurrency`/`formatCurrencyParts` from `loanUtils.ts` (not duplicated) and date helpers from `src/utils/dateUtils.ts` (`addMonths`, `getDaysInMonth`, `today`, `daysBetween`):
- `nextOccurrenceOfDay(dueDay: number, from: Date): Date` — nearest occurrence of `dueDay` on/after `from`, clamped to the month's actual last day (e.g. day 31 in February → Feb 28/29). Used on bill creation/edit to compute the initial `nextDueDate` from the form's day-of-month input.
- `advanceDueDate(current: string): string` — adds one month to `current` (not to today), reusing `current`'s own day-of-month (via `new Date(current).getDate()`) and clamping to the target month's actual last day the same way. Used when marking paid, so the cadence stays fixed to the schedule rather than drifting off whenever the user happens to pay.
- `isBillOverdue(bill): boolean` / `billDaysOverdue(bill): number` — same logic shape as `loanUtils.isOverdue`/`daysOverdue`, just without the loan's `isFullyPaid` check (bills don't have a payoff state).

Note: `Bill` has no separate `dueDay` field — `nextDueDate` alone is the source of truth for the schedule, and `advanceDueDate` derives the day-of-month from it directly. The form's "due day" input is only ever used transiently to compute `nextDueDate` via `nextOccurrenceOfDay`, never stored on its own. This avoids two fields that could drift apart, and matches how loans don't separately store "day of month" either — they just carry forward from `startDate`.

**`billStore.ts`** — same shape as `loanStore.ts`: `bills`, `billPayments`, `addBill`, `updateBill`, `markBillPaid` (creates a `BillPaymentRecord`, then sets `nextDueDate = advanceDueDate(bill.nextDueDate)`), `deleteBill`, `archiveBill`, `unarchiveBill`. Uses `showToast` the same way loans do (`"<name>" added`, `"<name>" deleted`, mark-paid toast with an UNDO action calling `undoBillPayment`, matching `undoMarkAsPaid`).

**`BillForm.tsx`** — mirrors `LoanForm.tsx`'s conventions (same `Field`/`Row` helpers, `input-field` class, validation-errors-map pattern, `useBodyScrollLock`): Name, Category (chip select from `BILL_CATEGORIES`, same visual treatment as loan tags), Color (`ColorPicker`), Amount (₱), Due day of month (number input, 1–31), Notes (optional textarea, same as loan notes). On edit, changing the due day recomputes `nextDueDate` via `nextOccurrenceOfDay` from today (simplest predictable behavior; documented as a minor known limitation, not a bug).

**`BillCard.tsx`** — same visual language as `LoanCard.tsx`: color avatar, name, category tag, `<CurrencyAmount value={bill.amount} />` in `font-mono`, and either "Due <date>" or an overdue badge (reusing the red `AlertTriangle` + day-count pattern from `LoanCard`). No progress bar — bills don't have a payoff percentage.

**`BillDetails.tsx`** + **`BillDetailsPage.tsx`** — same split as `LoanDetails.tsx`/`LoanDetailsPage.tsx`: thin page wrapper handles routing/store calls and the "not found" `EmptyState`, the feature component renders header (name, avatar, more-menu with Edit/Archive/Delete), an overdue banner when applicable (same pattern as `LoanDetails`' overdue banner), amount + next due date, a "Mark as Paid" button, and a payment history list (`BillPaymentRecord`s, most recent first).

**`BillsPage.tsx`** — same fat-page pattern as `Dashboard.tsx` (list logic lives directly in the page, no extra wrapper): gradient header with total monthly bills and bill count (reusing `SummaryHeader`'s visual style but a lighter version scoped to this page, not the shared component itself — it displays different fields), an overdue banner if any bills are overdue, an Archived filter toggle (matching Dashboard's archive pill), and a list of `BillCard`s sorted by soonest due date. No sort dropdown or grid/list toggle in this first pass — bills are a shorter, simpler list than loans.

## Savings feature

**New files:** `src/features/savings/{savingsTypes.ts, savingsUtils.ts, savingsStore.ts, SavingsGoalCard.tsx, SavingsGoalForm.tsx, SavingsGoalDetails.tsx, SavingsTransactionForm.tsx}`, `src/pages/{SavingsPage.tsx, SavingsGoalDetailsPage.tsx}`

**`savingsStore.ts`**: `goals`, `transactions`, `addGoal`, `updateGoal`, `addFunds(goalId, amount, note?)`, `withdrawFunds(goalId, amount, note?)`, `deleteGoal`, `archiveGoal`, `unarchiveGoal`.
- `addFunds`/`withdrawFunds` create a `SavingsTransaction` and update `goal.currentAmount` (clamped so a withdrawal can never take it below 0 — validated in the form before submit, same defense-in-depth as the rest of the app's numeric inputs).
- When a deposit brings `currentAmount` from below `targetAmount` to at-or-above it, trigger `triggerConfetti()` + a "🎉 <goal name> reached its goal!" toast — directly mirrors the existing loan fully-paid celebration in `loanStore.markAsPaid`, not a new UX pattern.

**`SavingsGoalForm.tsx`** — same conventions as `BillForm`/`LoanForm`: Name, Color, Target Amount (₱), Notes.

**`SavingsTransactionForm.tsx`** — small shared form used for both "Add Funds" and "Withdraw" (a `mode: 'deposit' | 'withdrawal'` prop swaps the title/button color/validation): Amount (₱), optional note. Withdrawal validates `amount <= goal.currentAmount`, surfaced via the same inline-error pattern `LoanForm` already uses.

**`SavingsGoalCard.tsx`** — color avatar, name, `<CurrencyAmount value={goal.currentAmount} />` **/** `<CurrencyAmount value={goal.targetAmount} />`, and a progress bar at `min(currentAmount/targetAmount, 1) * 100%` — same progress-bar visual as `LoanCard`, but here "full" means goal reached rather than debt cleared.

**`SavingsGoalDetails.tsx`** + **`SavingsGoalDetailsPage.tsx`** — same thin-wrapper/feature-component split as loans/bills: hero card (current balance large, target amount, progress bar, % complete — visually parallel to `LoanDetails`' remaining-balance hero), **Add Funds** and **Withdraw** buttons side by side, transaction history list (deposits/withdrawals with date, amount, note), more-menu with Edit/Archive/Delete.

**`SavingsPage.tsx`** — same fat-page pattern as `BillsPage.tsx`/`Dashboard.tsx`: header with total saved across active goals and goal count, Archived filter toggle, list of `SavingsGoalCard`s. No sort/filter beyond that in this first pass.

## Navigation

**`src/components/BottomNav.tsx`**
- `NAV_ITEMS`: replace the Analytics entry with `{ path: '/more', icon: MoreHorizontal, label: 'More' }`. Nav becomes Home, Calendar, **+Add**, More, Settings.
- Active-state check for the More item extends to match `/more`, `/analytics`, `/bills`, and `/savings` (and their subpaths) as a prefix check, not just exact `/more` — otherwise the nav shows no active tab while on Analytics/Bills/Savings, since they're no longer their own top-level tab.
- `hiddenPaths` (nav hidden on detail pages) extends from `['/loan/']` to `['/loan/', '/bills/', '/savings/']` — same trailing-slash prefix match, so it hides on `/bills/:id` and `/savings/:id` but not on the `/bills`/`/savings` list pages themselves.

**`src/pages/MorePage.tsx`** (new) — same gradient-header pattern as `SettingsPage.tsx`/`AnalyticsPage.tsx`, with three navigable rows below (icon + label + chevron, `bg-card rounded-2xl border border-themed` styling matching Settings' section cards): Analytics, Bills, Savings.

**`src/App.tsx`**
- New routes: `/more` → `MorePage`, `/bills` → `BillsPage`, `/bills/:id` → `BillDetailsPage`, `/savings` → `SavingsPage`, `/savings/:id` → `SavingsGoalDetailsPage`.
- The center **+** button becomes context-aware based on `useLocation().pathname`: exactly `/bills` opens `BillForm`, exactly `/savings` opens `SavingsGoalForm`, everything else keeps opening `LoanForm` (today's behavior). Detail pages (`/bills/:id`, `/savings/:id`) never need this distinction since the nav — and the + button with it — is hidden there.

## Backup & restore

**`src/utils/backup.ts`** (new) — composes all three stores instead of `loanStore` owning backup format alone:
- `exportAllData(): string` — reads `{ loans, payments, monthlyIncome }` from `useLoanStore`, `{ bills, billPayments }` from `useBillStore`, `{ savingsGoals, savingsTransactions }` from `useSavingsStore`, packages one JSON with `exportedAt`.
- `importAllData(json: string): boolean` — parses once, restores whichever of `loans`/`bills`/`savingsGoals` arrays are present (older backups predating this feature just won't have `bills`/`savingsGoals` keys, and those stores are left untouched — no hard failure on old backups).

`loanStore.ts` keeps its existing `exportBackup`/`importBackup` as the loans-only building block; `billStore.ts`/`savingsStore.ts` get the equivalent pair. `SettingsPage.tsx` swaps its calls from `useLoanStore().exportBackup/importBackup` to the new `exportAllData`/`importAllData`, and the "Restore backup?" confirmation copy generalizes from "N loans" to mention loans/bills/goals counts (only the categories actually present in the incoming file, so an old loans-only backup still reads naturally).

CSV export (`exportCSV`) stays loans-only, unchanged — confirmed out of scope.

## Explicitly out of scope

- No notifications/reminders for bills (confirmed).
- Bills and Savings are not surfaced in Calendar or Analytics — no due-date merging, no debt-to-income inclusion (confirmed).
- Home dashboard (`Dashboard.tsx`/`SummaryHeader.tsx`) is untouched — no bills/savings hint there.
- No sort dropdown or grid/list view toggle on `BillsPage`/`SavingsPage` (loans have this; bills/savings lists are expected to be much shorter).
- No CSV export for bills/savings, only JSON backup.
- No multi-currency or currency-conversion concerns — same single PHP currency as the rest of the app, using the existing `formatCurrency`/`CurrencyAmount` from the recent peso-glyph fix.

## Verification

Same QA gate as the rest of this project (no automated test suite): `npx tsc -b` and `npx eslint .` clean, plus a manual browser pass covering:
1. Add a bill, confirm it appears on `BillsPage` with the correct next-due date; mark it paid, confirm the due date advances by one month and a payment record is added; edit a bill's due day and confirm the date recomputes sensibly; archive/unarchive/delete a bill.
2. Add a savings goal, deposit funds via "Add Funds", confirm balance and progress bar update; withdraw more than the balance and confirm it's rejected; deposit enough to cross the target and confirm the reached-goal celebration fires once.
3. Bottom nav: confirm "More" tab highlights on `/more`, `/analytics`, `/bills`, and `/savings`; confirm nav hides on `/bills/:id` and `/savings/:id` like it does on `/loan/:id`; confirm the center **+** opens the right form on Home/Calendar/More/Settings vs. Bills vs. Savings.
4. Export a backup after adding bills and a savings goal, then restore it into a fresh browser profile (or after clearing localStorage) and confirm loans, bills, and savings goals all come back; restore an older loans-only backup (from before this change) and confirm it still imports without error.
