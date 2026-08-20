# Financial health foundation

## Purpose

Lendy's home screen and analytics read from `loanStore` only. Bills and savings exist as
features but never enter any shared calculation, so the app cannot answer the one question
that matters most: **what do I actually owe every month, and what is left?** Total monthly
commitments (loans + bills) is not computable anywhere in the codebase today.

This project adds the cross-domain layer that makes it computable, and puts one number on
top of it — a **Financial Health score** — so the home screen reflects the user's whole
position instead of their loans.

It is the foundation for later work ("Can I afford this?", payday planning, redirecting a
freed-up payment into savings), all of which need monthly commitments and uncommitted
income. Those features are **not** in this spec.

### Design constraints agreed up front

1. **Derive-only.** No new data entry, no new entity types. The score uses loans, bills,
   savings and the existing `monthlyIncome` and nothing else. The document that prompted
   this work proposed a "Spending Discipline" metric; the app records no spending, so it
   is dropped rather than fabricated.
2. **Live snapshot.** The score is computed fresh on every render. No score history is
   persisted. Trend-over-time is a separate future project.
3. **Home screen placement.** The score folds into the existing `SummaryHeader` above the
   loans list on `/`. No new route, no bottom-nav change.

## Architecture

A new feature module, `src/features/finance/`. It is a peer of `loans`/`bills`/`savings`
but owns no entities — it reads the other three and derives.

```
src/features/finance/
  financeTypes.ts          FinancialOverview, HealthScore, MetricScore, MetricKey
  financeUtils.ts          pure math — no React, no stores, no localStorage
  incomeStore.ts           monthlyIncome, moved out of loanStore
  useFinancialOverview.ts  hook — composes the stores, memoized
  HealthScoreCard.tsx      the visual
```

`financeUtils.ts` takes plain arrays and numbers in and returns numbers out. It imports
types from the other features but never their stores. This is what makes the scoring
formula testable without rendering anything, which matters because this layer will later
be the basis for affordability advice.

`backup.ts` already establishes the precedent for cross-domain composition (it reads all
three stores via `.getState()`), so this introduces no new architectural pattern — only a
place to put the pattern that isn't inside one of the domain features.

### Why not extend `loanUtils.ts`

`loanUtils.ts` is 330 lines with 33 exports and would have to import `Bill` and
`SavingsGoal`. Putting cross-domain math under `loans` is what produced the loans-only
home screen in the first place.

### Why not a `financeStore`

The overview is derived state. Storing it would require invalidation on every loan, bill
and savings mutation, for no benefit.

## Moving `monthlyIncome` out of `loanStore`

Income lives in `loanStore` (`loanStore.ts:111`) because loans were once its only
consumer. Bills, the score, and later the payday planner all need it.

New `src/features/finance/incomeStore.ts` holds `monthlyIncome` and `setMonthlyIncome`.

**Compatibility is mandatory — both formats stay byte-identical:**

- The localStorage key stays `loan-tracker-income`. Existing installs keep their income
  with no migration step.
- The backup JSON keeps its top-level `monthlyIncome` field, so backups exported before
  this change still restore, and backups exported after it still load into older builds.

`loanStore` drops `monthlyIncome`, `setMonthlyIncome` and the `INCOME_KEY` constant.
`exportBackup`/`importBackup` in `loanStore` and `exportAllData`/`importAllData` in
`backup.ts` read and write income via `useIncomeStore.getState()` instead.

Consumers to update: `SettingsPage.tsx`, `Dashboard.tsx`, `AnalyticsPage.tsx`,
`backup.ts`, `loanStore.ts`.

## Data model

No persisted types change. These are derived, in-memory only.

```ts
export type MetricKey = 'debtLoad' | 'cashFlow' | 'savingsBuffer' | 'paymentReliability'

export type MetricScore = {
  key: MetricKey
  label: string
  score: number            // 0-100, rounded
  weight: number           // contribution when included
  detail: string           // e.g. "23.3% of income"
  included: boolean        // false when inputs are insufficient
  omissionReason?: string  // shown in the breakdown when included === false
}

export type FinancialOverview = {
  monthlyIncome: number
  loanCommitments: number   // sum of scheduled monthly payments, active unpaid loans
  billCommitments: number   // sum of active bill amounts
  totalCommitments: number  // loans + bills
  uncommitted: number       // income - totalCommitments; may be negative
  uncommittedRatio: number  // uncommitted / income; 0 when income is 0
  totalDebt: number         // sum of remaining balances
  totalSavings: number      // sum of goal currentAmount
  runwayMonths: number      // savings / totalCommitments, falling back to
                            // monthlyIncome when totalCommitments is 0; 0 when both are
}

export type HealthScore = {
  score: number            // 0-100, rounded
  band: 'at-risk' | 'needs-attention' | 'stable' | 'healthy'
  label: string            // "Needs Attention"
  metrics: MetricScore[]   // all four, included or not
  suppressed: boolean      // true when income is 0 — render the prompt, not a number
}
```

`loanCommitments` uses `scheduledMonthlyPayment()` from `loanUtils.ts` (which already
handles the final-payment rounding adjustment), summed over loans where
`!archived && !isFullyPaid(loan)`. `billCommitments` sums `amount` over `!archived` bills.
`totalDebt` reuses `remainingBalance()`.

## The scoring formula

Four metrics, each 0-100, weights summing to 100. Scores interpolate **linearly within
each band** so the number moves smoothly as balances change rather than jumping at
threshold edges.

### Debt Load — weight 30

`loanCommitments / monthlyIncome`. **Bills are excluded from this metric by design.**
Folding utilities and subscriptions into a "debt" measure both overstates debt and makes
the ratio incomparable to the lending thresholds the bands are derived from.

| Ratio | Score |
|---|---|
| ≤ 10% | 100 |
| 10–20% | 100 → 75 |
| 20–36% | 75 → 45 |
| 36–43% | 45 → 25 |
| 43–50% | 25 → 10 |
| 50–70% | 10 → 0 |
| > 70% | 0 |

The 36% and 43% breakpoints are the conventional and qualified-mortgage DTI ceilings —
external and defensible rather than invented.

### Cash Flow — weight 25

`uncommittedRatio`. **Capped at 90; never returns 100.** The app tracks no groceries,
transport or discretionary spending, so a high uncommitted ratio shows only that fixed
obligations are light — not that the money is spare. The cap is the formula declaring
what it cannot see.

| Uncommitted ratio | Score |
|---|---|
| ≥ 60% | 90 |
| 50–60% | 75 → 90 |
| 35–50% | 50 → 75 |
| 25–35% | 30 → 50 |
| 10–25% | 10 → 30 |
| 0–10% | 0 → 10 |
| < 0% (over-committed) | 0 |

### Savings Buffer — weight 30

`runwayMonths = totalSavings / totalCommitments`. When `totalCommitments` is 0 the
denominator falls back to `monthlyIncome`; when both are 0 the metric is omitted.

| Runway | Score |
|---|---|
| 0 | 0 |
| 0–1 mo | 0 → 25 |
| 1–3 mo | 25 → 60 |
| 3–6 mo | 60 → 90 |
| 6–12 mo | 90 → 100 |
| > 12 mo | 100 |

### Payment Reliability — weight 15

On-time rate across the evidence set, with a **3-day grace period**: `paidAt` records when
the user tapped the button, not when money moved (the type comment in `loanTypes.ts` says
so), and that lag is systematic and always in the late direction.

**The evidence set excludes backfilled records.** `migrateExistingPayments`
(`loanStore.ts:51`) synthesizes records for pre-existing loans with
`paidAt: scheduledDate.toISOString()` — exactly the due date. Counted naively, every
migrated loan reports a flawless on-time history, so the metric would measure the
migration rather than the user.

Discriminator: a loan payment record is **backfilled** when its `paidAt` is exactly equal
to the ISO string of the corresponding entry in `paymentSchedule(loan)`. Real records come
from `new Date()` at tap time and will not match to the millisecond. This is deterministic
and directly testable against the migration's own output.

All `BillPaymentRecord`s are real — bills shipped with `recordBillPayment` and were never
backfilled — so all of them count. Loan and bill records are scored identically; the grace
period applies to both.

**Comparison granularity:** `paidAt` is an ISO datetime, `dueDate` an ISO date
(`YYYY-MM-DD`). Both are reduced to calendar days in local time before comparing, so a
payment is on time when `daysBetween(dueDate, paidAtDay) <= 3`. Comparing raw timestamps
would make any same-day payment after 00:00 look late.

**Fewer than 3 records in the evidence set → the metric is omitted, not guessed.**

### Aggregation

```
score = Σ(metric.score × metric.weight) / Σ(metric.weight)   // included metrics only
```

Omitted metrics renormalize over the remaining weight.

**Rounding order matters and is fixed:** each metric is `Math.round`ed *first*, and the
aggregate is computed from those rounded values, then rounded itself. This is deliberately
not the more precise option — weighting at full precision gives 51 for the worked example
below instead of 52. The card displays the metric breakdown, so a user adding up the
numbers on screen must arrive at the number on screen. Reproducibility beats a rounding
error of one point.

**Suppression rule:** when `monthlyIncome` is 0, Debt Load and Cash Flow are both omitted —
55 of 100 points. A number derived from the remainder would be misleading, so
`HealthScore.suppressed` is true and the card renders a set-your-income prompt instead of
a score. This mirrors the existing `hasIncome` handling in `SummaryHeader.tsx`.

### Bands

| Score | Band | Label | Color |
|---|---|---|---|
| 0–39 | `at-risk` | At Risk | `red-500` |
| 40–59 | `needs-attention` | Needs Attention | `bg-brand` |
| 60–79 | `stable` | Stable | `emerald-500` |
| 80–100 | `healthy` | Healthy | `emerald-500` |

Reuses the existing `statusClasses` triad from `loanUtils.ts`. No fifth color is
introduced, and the brand green accent (`BRAND_GRADIENT`) stays a reserved accent rather
than becoming a status color.

### Worked example (the user's real data)

Income ₱20,000 · loan payments ₱4,662 · bills ₱2,800 · savings ₱500.

| Metric | Input | Score | Weight |
|---|---|---:|---:|
| Debt Load | ₱4,662 ÷ ₱20,000 = 23.3% | 69 | 30 |
| Cash Flow | ₱12,538 uncommitted = 62.7% | 90 | 25 |
| Savings Buffer | ₱500 ÷ ₱7,462 = 0.07 mo | 2 | 30 |
| Payment Reliability | 0 real records | — | omitted |

`(69×30 + 90×25 + 2×30) / 85 = 51.5` → **52 / 100, Needs Attention.**

This example is a required test case.

## UI

`SummaryHeader.tsx` gains the score above its existing content. The loans list on `/` is
untouched.

- Score, band label, and **Committed ₱7,462 · Uncommitted ₱12,538**.
- The word is **Uncommitted**, never "Available." Income minus fixed obligations is not
  spending money — untracked living costs come out of it — and "available" is the word
  that turns a buffer into a purchase.
- Tapping expands an in-place breakdown listing all four metrics with their scores and
  `detail` strings. Omitted metrics appear greyed with their `omissionReason` ("Not enough
  payment history yet"), so the score never looks like it silently ignored something.
- When `suppressed`, the card shows the set-your-income prompt and no number.

`SummaryHeader` already receives its data as props from `Dashboard`. That stays — the
component keeps taking props, and `Dashboard` calls `useFinancialOverview()`.

## Testing

**Vitest is added** (`vitest` dev dependency, `npm test` script). There is currently no
test runner; a four-metric weighted formula with interpolated bands cannot be verified by
looking at a screen.

Scope: `financeUtils.ts` only. No component tests in this project.

Required cases:

- Each band boundary of each metric, including both edges and one interpolated midpoint.
- The worked example above → exactly 52.
- `monthlyIncome === 0` → `suppressed: true`.
- Zero loans, zero bills, zero savings, income set → no crash; buffer denominator falls
  back to income.
- Over-committed (commitments > income) → negative `uncommitted`, Cash Flow scores 0, no
  negative aggregate.
- Backfilled records excluded: build a loan, run the migration's own logic, assert the
  evidence set is empty.
- Evidence set of exactly 2 → Reliability omitted; exactly 3 → included.
- A payment 3 days late → on time; 4 days late → late.

## Explicitly out of scope

- "Can I Afford This?" calculator, debt lock, payday planner, loan-completion redirect,
  streaks, AI coach — all later projects that build on this layer.
- Score history, trend charts, month-over-month comparison.
- Any spending/expense tracking.
- A pay-schedule model. `monthlyIncome` stays a single number.
- Restructuring the bottom nav or moving the loans list off `/`.
- Changes to `AnalyticsPage` beyond the `monthlyIncome` import path.

## Verification

- `npm run build` passes (tsc + vite).
- `npm run lint` passes.
- `npm test` passes.
- A backup file exported before this change restores with income intact.
- `/` renders the score; income cleared in Settings → score suppresses and prompt appears.
