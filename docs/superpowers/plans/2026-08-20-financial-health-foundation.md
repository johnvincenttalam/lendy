# Financial Health Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a derive-only `src/features/finance/` module that computes total monthly commitments across loans, bills and savings, and surface a Financial Health score on the home screen.

**Architecture:** `financeUtils.ts` holds pure functions (plain data in, numbers out — no React, no stores, no `localStorage`), which makes the scoring formula testable in isolation. `useFinancialOverview.ts` composes the three existing Zustand stores and memoizes. `monthlyIncome` moves out of `loanStore` into its own `incomeStore` because it is no longer loans-only. `backup.ts` already reads all three stores via `.getState()`, so cross-domain composition is an established pattern here, not a new one.

**Tech Stack:** React 19, TypeScript 5.9 (strict), Zustand 5, Tailwind 4, Vite 8. Vitest is added by this plan — the repo currently has no test runner.

**Spec:** `docs/superpowers/specs/2026-08-20-financial-health-foundation-design.md`

## Global Constraints

- **Branch:** `financial-health-foundation`, based on `monthly-payment-consistency` (not `main`) with the spec committed. That base is required: `scheduledMonthlyPayment()` and the partial-bill-payment utilities exist only there.
- **Loan commitments use `scheduledMonthlyPayment(loan)`, never `loan.monthlyPayment`.** The stored field is hand-entered and drifts — `offScheduleAmount()` exists to detect exactly that drift.
- **Bill commitments use gross `bill.amount`, deliberately NOT `remainingForCycle()`.** A commitment is what recurs every month; a part-paid ₱1,500 electricity bill still costs ₱1,500 next month. `remainingForCycle()` answers "what do I still owe right now", which is a different question and belongs to upcoming-payments views, not to the health score.
- **localStorage key `loan-tracker-income` must not change.** Existing installs keep their income with no migration.
- **Backup JSON keeps its top-level `monthlyIncome` field.** Backups made before this change must still restore; backups made after must still load into older builds.
- **`verbatimModuleSyntax: true`** — type-only imports MUST use `import type { X } from '...'`. A plain `import { X }` for a type is a compile error.
- **`erasableSyntaxOnly: true`** — no `enum`, no constructor parameter properties. Use `as const` object literals or string-literal unions.
- **`noUnusedLocals` and `noUnusedParameters` are on.** An unused import fails `npm run build`.
- **UI copy rule:** income minus commitments is labelled **"Uncommitted"**, never "Available". This is a deliberate product decision recorded in the spec.
- **Currency is rendered by `<CurrencyAmount value={n} />`** (`src/components/CurrencyAmount.tsx`), never by hand-formatting.
- **Score colors reuse the existing triad only:** `red-500`, `bg-brand`, `emerald-500`. Do not introduce a new status color, and do not use the brand green from `BRAND_GRADIENT` as a status color.
- **Every task ends with a commit.** Do not batch commits across tasks.

---

### Task 1: Move `monthlyIncome` out of `loanStore` into its own store

Pure refactor. No behavior change, no new features. Verified by build, lint, and a manual backup round-trip.

**Files:**
- Create: `src/features/finance/incomeStore.ts`
- Modify: `src/features/loans/loanStore.ts` (remove income; lines 10, 83, 94, 110, 296-299, 330-331, 350-352)
- Modify: `src/pages/Dashboard.tsx:27`
- Modify: `src/pages/AnalyticsPage.tsx:134`
- Modify: `src/pages/SettingsPage.tsx:19`
- Modify: `src/utils/backup.ts:7`

**Interfaces:**
- Consumes: nothing (first task).
- Produces: `useIncomeStore` — a Zustand hook exposing `{ monthlyIncome: number, setMonthlyIncome: (income: number) => void }`, plus `setMonthlyIncomeFromBackup(income: number): void` for restore paths that must write both `localStorage` and store state without going through a React render.

- [ ] **Step 1: Create the income store**

Create `src/features/finance/incomeStore.ts`:

```ts
import { create } from 'zustand'

const INCOME_KEY = 'loan-tracker-income'

type IncomeStore = {
  monthlyIncome: number
  setMonthlyIncome: (income: number) => void
}

export const useIncomeStore = create<IncomeStore>((set) => ({
  monthlyIncome: Number(localStorage.getItem(INCOME_KEY)) || 0,

  setMonthlyIncome: (income) => {
    localStorage.setItem(INCOME_KEY, String(income))
    set({ monthlyIncome: income })
  },
}))

/**
 * Restore path: writes localStorage and store state directly. Used by backup
 * import, which runs outside React and must not depend on a mounted component.
 */
export function setMonthlyIncomeFromBackup(income: number) {
  localStorage.setItem(INCOME_KEY, String(income))
  useIncomeStore.setState({ monthlyIncome: income })
}
```

The key string is duplicated from `loanStore.ts:10` intentionally — that line is deleted in Step 2, so this becomes the single definition.

- [ ] **Step 2: Strip income out of `loanStore.ts`**

Delete these, in `src/features/loans/loanStore.ts`:

- Line 10: `const INCOME_KEY = 'loan-tracker-income'`
- Line 83: `monthlyIncome: number` from the `LoanStore` type
- Line 94: `setMonthlyIncome: (income: number) => void` from the `LoanStore` type
- Line 110: `monthlyIncome: Number(localStorage.getItem(INCOME_KEY)) || 0,` from the initializer
- Lines 296-299: the whole `setMonthlyIncome` action

Add this import at the top of the file:

```ts
import { useIncomeStore, setMonthlyIncomeFromBackup } from '../finance/incomeStore'
```

Replace `exportBackup` (lines 329-332) with:

```ts
  exportBackup: () => {
    const { loans, payments } = get()
    const { monthlyIncome } = useIncomeStore.getState()
    return JSON.stringify({ loans, payments, monthlyIncome, exportedAt: new Date().toISOString() }, null, 2)
  },
```

Replace the income branch inside `importBackup` (lines 350-354) with:

```ts
      if (data.monthlyIncome) {
        setMonthlyIncomeFromBackup(data.monthlyIncome)
      }
      set({ loans, payments })
```

Note the restructure: previously the `set({ loans, payments, monthlyIncome })` call was inside the `if` and duplicated in the `else`. Income now lives in a different store, so `set({ loans, payments })` runs unconditionally and the `else` branch disappears entirely.

- [ ] **Step 3: Update the four consumers**

`src/pages/Dashboard.tsx:27` — change:

```ts
  const { loans, sortBy, setSortBy, monthlyIncome, viewMode, setViewMode } = useLoanStore()
```

to:

```ts
  const { loans, sortBy, setSortBy, viewMode, setViewMode } = useLoanStore()
  const { monthlyIncome } = useIncomeStore()
```

`src/pages/AnalyticsPage.tsx:134` — change:

```ts
  const { loans, payments, monthlyIncome } = useLoanStore()
```

to:

```ts
  const { loans, payments } = useLoanStore()
  const { monthlyIncome } = useIncomeStore()
```

`src/pages/SettingsPage.tsx:19` — change:

```ts
  const { loans, monthlyIncome, setMonthlyIncome, exportCSV } = useLoanStore()
```

to:

```ts
  const { loans, exportCSV } = useLoanStore()
  const { monthlyIncome, setMonthlyIncome } = useIncomeStore()
```

`src/utils/backup.ts:7` — change:

```ts
  const { loans, payments, monthlyIncome } = useLoanStore.getState()
```

to:

```ts
  const { loans, payments } = useLoanStore.getState()
  const { monthlyIncome } = useIncomeStore.getState()
```

Add to each of the four files (path adjusted per file — `../features/finance/incomeStore` from `src/pages/` and `src/utils/`):

```ts
import { useIncomeStore } from '../features/finance/incomeStore'
```

- [ ] **Step 4: Verify the build and lint pass**

Run: `npm run build`
Expected: PASS. If it fails with "Property 'monthlyIncome' does not exist", a consumer was missed — grep for it.

Run: `npm run lint`
Expected: PASS, no unused-import warnings.

Run: `grep -rn "monthlyIncome" src/features/loans/`
Expected: only `loanUtils.ts` (the `debtToIncomeRatio` parameter, which is just a parameter name) and the `exportBackup`/`importBackup` lines added in Step 2.

- [ ] **Step 5: Verify the backup round-trip by hand**

This is the one thing the type checker cannot confirm, and the compatibility constraint is non-negotiable.

1. Run `npm run dev`, open the app, go to Settings, set monthly income to `20000`.
2. Export a backup. Open the downloaded JSON and confirm it contains `"monthlyIncome": 20000` at the top level.
3. In DevTools, run `localStorage.removeItem('loan-tracker-income')` and reload. Income should show empty.
4. Import the backup file. Income must come back as 20000.

Expected: income survives the round-trip and the JSON shape is unchanged.

- [ ] **Step 6: Commit**

```bash
git add src/features/finance/incomeStore.ts src/features/loans/loanStore.ts src/pages/Dashboard.tsx src/pages/AnalyticsPage.tsx src/pages/SettingsPage.tsx src/utils/backup.ts
git commit -m "Move monthlyIncome out of loanStore into its own store"
```

---

### Task 2: Add Vitest and build the financial overview

Vitest setup is folded in here because this is the first task that needs it.

**Files:**
- Modify: `package.json` (add `vitest` dev dependency + `test` scripts)
- Create: `src/features/finance/financeTypes.ts`
- Create: `src/features/finance/financeUtils.ts`
- Test: `src/features/finance/financeUtils.test.ts`

**Interfaces:**
- Consumes: `scheduledMonthlyPayment`, `remainingBalance`, `isFullyPaid` from `../loans/loanUtils`.
- Produces: `buildOverview(input: OverviewInput): FinancialOverview`, and the types `OverviewInput`, `FinancialOverview`, `MetricKey`, `MetricScore`, `HealthScore`, `ScoreBandName`.

- [ ] **Step 1: Install Vitest**

Run: `npm install -D vitest`

Install the current release rather than a pinned version — this repo is on Vite 8, and the matching Vitest major is whatever npm resolves as latest. Step 4 confirms it actually runs.

Then add to the `scripts` block in `package.json`:

```json
    "test": "vitest run",
    "test:watch": "vitest",
```

No `vite.config.ts` change is needed. Vitest reads the existing config, the defaults (`environment: 'node'`, include `**/*.test.ts`) are correct for pure-function tests, and no jsdom is required because no component tests are in scope.

Tests live beside the code as `*.test.ts` inside `src/`, so `tsc -b` type-checks them on every build. That is intended. Import test helpers explicitly — `import { describe, it, expect } from 'vitest'` — rather than enabling globals, so `tsconfig.app.json` needs no `types` change.

- [ ] **Step 2: Write the types**

Create `src/features/finance/financeTypes.ts`:

```ts
export type MetricKey = 'debtLoad' | 'cashFlow' | 'savingsBuffer' | 'paymentReliability'

export type MetricScore = {
  key: MetricKey
  label: string
  /** 0-100, already rounded */
  score: number
  /** Contribution to the aggregate when included */
  weight: number
  /** Human-readable input, e.g. "23.3% of income" */
  detail: string
  included: boolean
  /** Shown in the breakdown when included is false */
  omissionReason?: string
}

export type FinancialOverview = {
  monthlyIncome: number
  /** Sum of scheduled monthly payments across active, unpaid loans */
  loanCommitments: number
  /** Sum of amounts across active bills */
  billCommitments: number
  totalCommitments: number
  /** monthlyIncome - totalCommitments; may be negative */
  uncommitted: number
  /** uncommitted / monthlyIncome; 0 when income is 0 */
  uncommittedRatio: number
  /** Sum of remaining balances across active, unpaid loans */
  totalDebt: number
  /** Sum of currentAmount across active savings goals */
  totalSavings: number
  /**
   * totalSavings / totalCommitments, falling back to monthlyIncome as the
   * denominator when there are no commitments; 0 when both are 0.
   */
  runwayMonths: number
}

export type ScoreBandName = 'at-risk' | 'needs-attention' | 'stable' | 'healthy'

export type HealthScore = {
  /** 0-100, already rounded */
  score: number
  band: ScoreBandName
  /** Display label, e.g. "Needs Attention" */
  label: string
  /** All four metrics, included or not, in display order */
  metrics: MetricScore[]
  /** True when monthlyIncome is 0 — render the prompt, not a number */
  suppressed: boolean
}
```

- [ ] **Step 3: Write the failing test**

Create `src/features/finance/financeUtils.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { buildOverview } from './financeUtils'
import type { Loan } from '../loans/loanTypes'
import type { Bill } from '../bills/billTypes'
import type { SavingsGoal } from '../savings/savingsTypes'

function makeLoan(overrides: Partial<Loan> = {}): Loan {
  return {
    id: 'loan-1',
    name: 'Test Loan',
    color: '#F3622D',
    totalAmount: 9000,
    monthlyPayment: 1000,
    interestRate: 0,
    durationMonths: 9,
    startDate: '2026-01-01',
    monthsPaid: 0,
    totalPaid: 0,
    totalInterestPaid: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

/**
 * A 0%-interest loan whose *derived* scheduled payment is exactly `monthly`.
 *
 * buildOverview uses scheduledMonthlyPayment(), which recomputes from
 * totalAmount/interestRate/durationMonths and ignores the stored
 * monthlyPayment field entirely. Setting monthlyPayment in a fixture and
 * expecting commitments to reflect it is the trap this helper exists to avoid.
 */
function makeLoanPaying(monthly: number, overrides: Partial<Loan> = {}): Loan {
  const durationMonths = overrides.durationMonths ?? 9
  return makeLoan({
    totalAmount: monthly * durationMonths,
    interestRate: 0,
    durationMonths,
    monthlyPayment: monthly,
    ...overrides,
  })
}

function makeBill(overrides: Partial<Bill> = {}): Bill {
  return {
    id: 'bill-1',
    name: 'Electricity',
    color: '#3B82F6',
    category: 'Utilities',
    amount: 1500,
    nextDueDate: '2026-09-01',
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

function makeGoal(overrides: Partial<SavingsGoal> = {}): SavingsGoal {
  return {
    id: 'goal-1',
    name: 'Emergency Fund',
    color: '#10B981',
    targetAmount: 20000,
    currentAmount: 500,
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('buildOverview', () => {
  it('sums commitments across loans and bills', () => {
    const overview = buildOverview({
      loans: [makeLoanPaying(1105), makeLoanPaying(650, { id: 'l2' })],
      bills: [makeBill({ amount: 1500 }), makeBill({ id: 'b2', amount: 1250 })],
      goals: [],
      monthlyIncome: 20000,
    })

    expect(overview.loanCommitments).toBeCloseTo(1755, 2)
    expect(overview.billCommitments).toBe(2750)
    expect(overview.totalCommitments).toBeCloseTo(4505, 2)
    expect(overview.uncommitted).toBeCloseTo(15495, 2)
    expect(overview.uncommittedRatio).toBeCloseTo(0.77475, 5)
  })

  it('excludes archived and fully paid loans, archived bills, archived goals', () => {
    const overview = buildOverview({
      loans: [
        makeLoanPaying(1105),
        makeLoanPaying(900, { id: 'l2', archived: true }),
        makeLoanPaying(800, { id: 'l3', monthsPaid: 9, durationMonths: 9 }),
      ],
      bills: [makeBill({ amount: 1500 }), makeBill({ id: 'b2', amount: 999, archived: true })],
      goals: [makeGoal({ currentAmount: 500 }), makeGoal({ id: 'g2', currentAmount: 777, archived: true })],
      monthlyIncome: 20000,
    })

    expect(overview.loanCommitments).toBeCloseTo(1105, 2)
    expect(overview.billCommitments).toBe(1500)
    expect(overview.totalSavings).toBe(500)
  })

  it('reports runway in months of commitments', () => {
    const overview = buildOverview({
      loans: [makeLoanPaying(4662)],
      bills: [makeBill({ amount: 2800 })],
      goals: [makeGoal({ currentAmount: 500 })],
      monthlyIncome: 20000,
    })

    expect(overview.totalCommitments).toBeCloseTo(7462, 2)
    expect(overview.runwayMonths).toBeCloseTo(500 / 7462, 6)
  })

  it('falls back to income as the runway denominator when there are no commitments', () => {
    const overview = buildOverview({ loans: [], bills: [], goals: [makeGoal({ currentAmount: 10000 })], monthlyIncome: 20000 })
    expect(overview.runwayMonths).toBeCloseTo(0.5, 6)
  })

  it('returns zero runway and zero ratio when income and commitments are both zero', () => {
    const overview = buildOverview({ loans: [], bills: [], goals: [], monthlyIncome: 0 })
    expect(overview.runwayMonths).toBe(0)
    expect(overview.uncommittedRatio).toBe(0)
    expect(overview.uncommitted).toBe(0)
  })

  it('reports a negative uncommitted amount when over-committed', () => {
    const overview = buildOverview({
      loans: [makeLoanPaying(8000)],
      bills: [makeBill({ amount: 5000 })],
      goals: [],
      monthlyIncome: 10000,
    })

    expect(overview.uncommitted).toBeCloseTo(-3000, 2)
    expect(overview.uncommittedRatio).toBeCloseTo(-0.3, 5)
  })
})
```

Note: the archived-goal filter is a small refinement on the spec, which said "sum of goal `currentAmount`" without qualification. Archived goals are hidden from the user, so counting their balance toward the buffer would inflate the score with money the user considers put away. Everything else already filters archived; this matches.

- [ ] **Step 4: Run the test to verify it fails**

Run: `npm test`
Expected: FAIL — `Failed to resolve import "./financeUtils"`. This also confirms Vitest itself is installed and running.

- [ ] **Step 5: Implement `buildOverview`**

Create `src/features/finance/financeUtils.ts`:

```ts
import type { Loan } from '../loans/loanTypes'
import type { Bill } from '../bills/billTypes'
import type { SavingsGoal } from '../savings/savingsTypes'
import type { FinancialOverview } from './financeTypes'
import { scheduledMonthlyPayment, remainingBalance, isFullyPaid } from '../loans/loanUtils'

export type OverviewInput = {
  loans: Loan[]
  bills: Bill[]
  goals: SavingsGoal[]
  monthlyIncome: number
}

export function buildOverview({ loans, bills, goals, monthlyIncome }: OverviewInput): FinancialOverview {
  const activeLoans = loans.filter((l) => !l.archived && !isFullyPaid(l))

  // scheduledMonthlyPayment, not loan.monthlyPayment: the stored field is
  // hand-entered and drifts from the amount/rate/tenure beside it.
  const loanCommitments = activeLoans.reduce((sum, l) => sum + scheduledMonthlyPayment(l), 0)

  // Gross amount, not remainingForCycle: a commitment is what recurs every
  // month. A part-paid electricity bill still costs its full amount next month.
  const billCommitments = bills.filter((b) => !b.archived).reduce((sum, b) => sum + b.amount, 0)
  const totalCommitments = loanCommitments + billCommitments

  const uncommitted = monthlyIncome - totalCommitments
  const uncommittedRatio = monthlyIncome > 0 ? uncommitted / monthlyIncome : 0

  const totalDebt = activeLoans.reduce((sum, l) => sum + remainingBalance(l), 0)
  const totalSavings = goals.filter((g) => !g.archived).reduce((sum, g) => sum + g.currentAmount, 0)

  // No commitments yet? Measure the buffer against income instead, so a user
  // with savings and no debt isn't scored against a zero denominator.
  const runwayDenominator = totalCommitments > 0 ? totalCommitments : monthlyIncome
  const runwayMonths = runwayDenominator > 0 ? totalSavings / runwayDenominator : 0

  return {
    monthlyIncome,
    loanCommitments,
    billCommitments,
    totalCommitments,
    uncommitted,
    uncommittedRatio,
    totalDebt,
    totalSavings,
    runwayMonths,
  }
}
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `npm test`
Expected: PASS, 6 tests.

Run: `npm run build`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json src/features/finance/financeTypes.ts src/features/finance/financeUtils.ts src/features/finance/financeUtils.test.ts
git commit -m "Add Vitest and the cross-domain financial overview"
```

---

### Task 3: Score Debt Load, Cash Flow and Savings Buffer

Three of the four metrics share one interpolation helper. Payment Reliability is different enough to get its own task.

**Files:**
- Modify: `src/features/finance/financeUtils.ts`
- Test: `src/features/finance/financeUtils.test.ts`

**Interfaces:**
- Consumes: `FinancialOverview`, `MetricScore` from `./financeTypes`.
- Produces: `interpolateScore(value: number, points: ReadonlyArray<readonly [number, number]>): number` (unrounded), `scoreDebtLoad(o: FinancialOverview): MetricScore`, `scoreCashFlow(o: FinancialOverview): MetricScore`, `scoreSavingsBuffer(o: FinancialOverview): MetricScore`.

- [ ] **Step 1: Write the failing tests**

Append to `src/features/finance/financeUtils.test.ts`, and extend the existing import from `./financeUtils` to include the four new names:

```ts
describe('interpolateScore', () => {
  const points = [[0, 0], [1, 25], [3, 60]] as const

  it('clamps below the first point', () => {
    expect(interpolateScore(-5, points)).toBe(0)
  })

  it('clamps above the last point', () => {
    expect(interpolateScore(99, points)).toBe(60)
  })

  it('returns the exact score at a breakpoint', () => {
    expect(interpolateScore(1, points)).toBe(25)
  })

  it('interpolates linearly between breakpoints', () => {
    expect(interpolateScore(2, points)).toBeCloseTo(42.5, 6)
  })
})

describe('scoreDebtLoad', () => {
  function atRatio(ratio: number) {
    return scoreDebtLoad({ ...zeroOverview, monthlyIncome: 20000, loanCommitments: 20000 * ratio })
  }

  it('scores 100 at or below 10% of income', () => {
    expect(atRatio(0.05).score).toBe(100)
    expect(atRatio(0.10).score).toBe(100)
  })

  it('scores the conventional DTI ceilings at their band edges', () => {
    expect(atRatio(0.20).score).toBe(75)
    expect(atRatio(0.36).score).toBe(45)
    expect(atRatio(0.43).score).toBe(25)
    expect(atRatio(0.50).score).toBe(10)
  })

  it('scores 0 at or above 70%', () => {
    expect(atRatio(0.70).score).toBe(0)
    expect(atRatio(0.95).score).toBe(0)
  })

  it('interpolates inside a band', () => {
    // 23.31% sits 20.69% of the way from 0.20 to 0.36, so 75 - 6.21 = 68.79 -> 69
    expect(atRatio(0.2331).score).toBe(69)
  })

  it('ignores bills entirely', () => {
    const withBills = scoreDebtLoad({ ...zeroOverview, monthlyIncome: 20000, loanCommitments: 4000, billCommitments: 9000 })
    const withoutBills = scoreDebtLoad({ ...zeroOverview, monthlyIncome: 20000, loanCommitments: 4000 })
    expect(withBills.score).toBe(withoutBills.score)
  })

  it('is omitted when there is no income', () => {
    const metric = scoreDebtLoad({ ...zeroOverview, monthlyIncome: 0, loanCommitments: 4000 })
    expect(metric.included).toBe(false)
    expect(metric.omissionReason).toBeTruthy()
  })
})

describe('scoreCashFlow', () => {
  function atRatio(ratio: number) {
    return scoreCashFlow({ ...zeroOverview, monthlyIncome: 20000, uncommittedRatio: ratio })
  }

  it('caps at 90 and never reaches 100', () => {
    expect(atRatio(0.60).score).toBe(90)
    expect(atRatio(0.99).score).toBe(90)
  })

  it('scores band edges', () => {
    expect(atRatio(0.50).score).toBe(75)
    expect(atRatio(0.35).score).toBe(50)
    expect(atRatio(0.25).score).toBe(30)
    expect(atRatio(0.10).score).toBe(10)
  })

  it('scores 0 when over-committed', () => {
    expect(atRatio(-0.3).score).toBe(0)
    expect(atRatio(0).score).toBe(0)
  })

  it('is omitted when there is no income', () => {
    expect(scoreCashFlow({ ...zeroOverview, monthlyIncome: 0 }).included).toBe(false)
  })
})

describe('scoreSavingsBuffer', () => {
  function atRunway(months: number) {
    return scoreSavingsBuffer({ ...zeroOverview, monthlyIncome: 20000, totalCommitments: 7462, runwayMonths: months })
  }

  it('scores 0 with no savings', () => {
    expect(atRunway(0).score).toBe(0)
  })

  it('scores band edges', () => {
    expect(atRunway(1).score).toBe(25)
    expect(atRunway(3).score).toBe(60)
    expect(atRunway(6).score).toBe(90)
    expect(atRunway(12).score).toBe(100)
  })

  it('caps at 100 beyond a year of runway', () => {
    expect(atRunway(40).score).toBe(100)
  })

  it('scores a near-empty buffer close to zero', () => {
    expect(atRunway(500 / 7462).score).toBe(2)
  })

  it('is omitted when there is neither income nor commitments to measure against', () => {
    const metric = scoreSavingsBuffer({ ...zeroOverview, monthlyIncome: 0, totalCommitments: 0 })
    expect(metric.included).toBe(false)
  })

  it('is included with no commitments as long as there is income', () => {
    expect(scoreSavingsBuffer({ ...zeroOverview, monthlyIncome: 20000, totalCommitments: 0, runwayMonths: 0.5 }).included).toBe(true)
  })
})
```

Also add this shared fixture near the top of the test file, below the `makeGoal` helper:

```ts
const zeroOverview: FinancialOverview = {
  monthlyIncome: 0,
  loanCommitments: 0,
  billCommitments: 0,
  totalCommitments: 0,
  uncommitted: 0,
  uncommittedRatio: 0,
  totalDebt: 0,
  totalSavings: 0,
  runwayMonths: 0,
}
```

and extend the type import at the top of the test file:

```ts
import type { FinancialOverview } from './financeTypes'
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test`
Expected: FAIL — `interpolateScore is not exported`.

- [ ] **Step 3: Implement the helper and the three metrics**

Append to `src/features/finance/financeUtils.ts`, and extend the type import to include `MetricScore`:

```ts
/**
 * Breakpoint tables: [input, score] pairs sorted ascending by input.
 * Values between two points interpolate linearly; values outside the table
 * clamp to the nearest end. Interpolating (rather than stepping) keeps the
 * score moving smoothly as balances change instead of jumping at edges.
 */
const DEBT_LOAD_POINTS = [
  [0.10, 100],
  [0.20, 75],
  [0.36, 45], // conventional DTI ceiling
  [0.43, 25], // qualified-mortgage ceiling
  [0.50, 10],
  [0.70, 0],
] as const

const CASH_FLOW_POINTS = [
  [0, 0],
  [0.10, 10],
  [0.25, 30],
  [0.35, 50],
  [0.50, 75],
  [0.60, 90], // capped at 90: untracked living costs mean this can never be a perfect score
] as const

const SAVINGS_BUFFER_POINTS = [
  [0, 0],
  [1, 25],
  [3, 60],
  [6, 90],
  [12, 100],
] as const

export function interpolateScore(value: number, points: ReadonlyArray<readonly [number, number]>): number {
  const first = points[0]
  const last = points[points.length - 1]
  if (value <= first[0]) return first[1]
  if (value >= last[0]) return last[1]

  for (let i = 1; i < points.length; i++) {
    const [prevInput, prevScore] = points[i - 1]
    const [currInput, currScore] = points[i]
    if (value <= currInput) {
      const t = (value - prevInput) / (currInput - prevInput)
      return prevScore + t * (currScore - prevScore)
    }
  }

  return last[1]
}

const NO_INCOME = 'Set your monthly income to unlock this'

export function scoreDebtLoad(overview: FinancialOverview): MetricScore {
  const base = { key: 'debtLoad', label: 'Debt Load', weight: 30 } as const

  if (overview.monthlyIncome <= 0) {
    return { ...base, score: 0, detail: 'No income set', included: false, omissionReason: NO_INCOME }
  }

  // Bills are deliberately excluded: folding utilities into a "debt" measure
  // overstates debt and breaks comparability with lending DTI thresholds.
  const ratio = overview.loanCommitments / overview.monthlyIncome

  return {
    ...base,
    score: Math.round(interpolateScore(ratio, DEBT_LOAD_POINTS)),
    detail: `${(ratio * 100).toFixed(1)}% of income goes to loans`,
    included: true,
  }
}

export function scoreCashFlow(overview: FinancialOverview): MetricScore {
  const base = { key: 'cashFlow', label: 'Cash Flow', weight: 25 } as const

  if (overview.monthlyIncome <= 0) {
    return { ...base, score: 0, detail: 'No income set', included: false, omissionReason: NO_INCOME }
  }

  const ratio = overview.uncommittedRatio

  return {
    ...base,
    score: Math.round(interpolateScore(ratio, CASH_FLOW_POINTS)),
    detail: `${(ratio * 100).toFixed(1)}% of income is uncommitted`,
    included: true,
  }
}

export function scoreSavingsBuffer(overview: FinancialOverview): MetricScore {
  const base = { key: 'savingsBuffer', label: 'Savings Buffer', weight: 30 } as const

  if (overview.totalCommitments <= 0 && overview.monthlyIncome <= 0) {
    return {
      ...base,
      score: 0,
      detail: 'Nothing to measure against yet',
      included: false,
      omissionReason: 'Add a bill, a loan, or your income to measure your buffer',
    }
  }

  return {
    ...base,
    score: Math.round(interpolateScore(overview.runwayMonths, SAVINGS_BUFFER_POINTS)),
    detail: `${overview.runwayMonths.toFixed(1)} months of commitments covered`,
    included: true,
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test`
Expected: PASS. If `atRatio(0.2331).score` returns 68 instead of 69, the interpolation direction is inverted — check that `DEBT_LOAD_POINTS` descends in score as the ratio rises.

Run: `npm run build`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/finance/financeUtils.ts src/features/finance/financeUtils.test.ts
git commit -m "Score debt load, cash flow and savings buffer"
```

---

### Task 4: Score Payment Reliability

The subtle task. `migrateExistingPayments` (`loanStore.ts:51`) backfills records with `paidAt` set to exactly the due date, so counting records naively reports a flawless on-time history for every pre-existing loan — the metric would measure the migration, not the user.

**Files:**
- Modify: `src/features/finance/financeUtils.ts`
- Test: `src/features/finance/financeUtils.test.ts`

**Interfaces:**
- Consumes: `paymentSchedule` from `../loans/loanUtils`; `daysBetween` from `../../utils/dateUtils`; types `PaymentRecord`, `Loan`, `BillPaymentRecord`.
- Produces: `isBackfilledPayment(payment: PaymentRecord, loan: Loan): boolean`, `scoreReliability(loans: Loan[], payments: PaymentRecord[], billPayments: BillPaymentRecord[]): MetricScore`.

- [ ] **Step 1: Write the failing tests**

Append to `src/features/finance/financeUtils.test.ts`, extending imports as needed:

```ts
import type { PaymentRecord } from '../loans/loanTypes'
import type { BillPaymentRecord } from '../bills/billTypes'
import { paymentSchedule } from '../loans/loanUtils'

function makePayment(overrides: Partial<PaymentRecord> = {}): PaymentRecord {
  return {
    id: 'pay-1',
    loanId: 'loan-1',
    amount: 1105,
    principal: 1000,
    interest: 105,
    paidAt: '2026-01-01T09:30:00.000Z',
    dueDate: '2026-01-01',
    month: 1,
    ...overrides,
  }
}

function makeBillPayment(overrides: Partial<BillPaymentRecord> = {}): BillPaymentRecord {
  return {
    id: 'bp-1',
    billId: 'bill-1',
    amount: 1500,
    paidAt: '2026-01-01T09:30:00.000Z',
    dueDate: '2026-01-01',
    ...overrides,
  }
}

/** Reproduces exactly what migrateExistingPayments writes, for one month. */
function makeBackfilledPayment(loan: Loan, month: number): PaymentRecord {
  const scheduledDate = paymentSchedule(loan)[month - 1].date
  return makePayment({
    id: `backfill-${month}`,
    loanId: loan.id,
    paidAt: scheduledDate.toISOString(),
    dueDate: scheduledDate.toISOString().split('T')[0],
    month,
  })
}

describe('isBackfilledPayment', () => {
  it('identifies a record written by the payment migration', () => {
    const loan = makeLoan({ monthsPaid: 3 })
    expect(isBackfilledPayment(makeBackfilledPayment(loan, 1), loan)).toBe(true)
    expect(isBackfilledPayment(makeBackfilledPayment(loan, 3), loan)).toBe(true)
  })

  it('does not flag a real tap-time record', () => {
    const loan = makeLoan({ monthsPaid: 1 })
    const real = makePayment({ loanId: loan.id, month: 1, paidAt: '2026-01-01T09:30:12.345Z' })
    expect(isBackfilledPayment(real, loan)).toBe(false)
  })
})

describe('scoreReliability', () => {
  const loan = makeLoan({ id: 'loan-1', durationMonths: 9, monthsPaid: 5 })

  it('is omitted when the evidence set is empty', () => {
    const metric = scoreReliability([loan], [], [])
    expect(metric.included).toBe(false)
    expect(metric.omissionReason).toBeTruthy()
  })

  it('ignores backfilled records entirely', () => {
    const backfilled = [1, 2, 3, 4, 5].map((m) => makeBackfilledPayment(loan, m))
    expect(scoreReliability([loan], backfilled, []).included).toBe(false)
  })

  it('is omitted at two records and included at three', () => {
    const two = [
      makePayment({ id: 'a', month: 1, dueDate: '2026-01-01', paidAt: '2026-01-01T10:00:00.000Z' }),
      makePayment({ id: 'b', month: 2, dueDate: '2026-02-01', paidAt: '2026-02-01T10:00:00.000Z' }),
    ]
    expect(scoreReliability([loan], two, []).included).toBe(false)

    const three = [...two, makePayment({ id: 'c', month: 3, dueDate: '2026-03-01', paidAt: '2026-03-01T10:00:00.000Z' })]
    const metric = scoreReliability([loan], three, [])
    expect(metric.included).toBe(true)
    expect(metric.score).toBe(100)
  })

  it('allows a three-day grace period and fails on the fourth', () => {
    const onTime = [
      makePayment({ id: 'a', month: 1, dueDate: '2026-01-01', paidAt: '2026-01-04T10:00:00.000Z' }),
      makePayment({ id: 'b', month: 2, dueDate: '2026-02-01', paidAt: '2026-02-04T10:00:00.000Z' }),
      makePayment({ id: 'c', month: 3, dueDate: '2026-03-01', paidAt: '2026-03-04T10:00:00.000Z' }),
    ]
    expect(scoreReliability([loan], onTime, []).score).toBe(100)

    const oneLate = [
      ...onTime.slice(0, 2),
      makePayment({ id: 'c', month: 3, dueDate: '2026-03-01', paidAt: '2026-03-05T10:00:00.000Z' }),
    ]
    expect(scoreReliability([loan], oneLate, []).score).toBe(67)
  })

  it('treats an early payment as on time', () => {
    const early = [
      makePayment({ id: 'a', month: 1, dueDate: '2026-01-10', paidAt: '2026-01-02T10:00:00.000Z' }),
      makePayment({ id: 'b', month: 2, dueDate: '2026-02-10', paidAt: '2026-02-02T10:00:00.000Z' }),
      makePayment({ id: 'c', month: 3, dueDate: '2026-03-10', paidAt: '2026-03-02T10:00:00.000Z' }),
    ]
    expect(scoreReliability([loan], early, []).score).toBe(100)
  })

  it('counts bill payments as evidence alongside loan payments', () => {
    const bills = [
      makeBillPayment({ id: 'bp1', dueDate: '2026-01-01', paidAt: '2026-01-01T10:00:00.000Z' }),
      makeBillPayment({ id: 'bp2', dueDate: '2026-02-01', paidAt: '2026-02-01T10:00:00.000Z' }),
      makeBillPayment({ id: 'bp3', dueDate: '2026-03-01', paidAt: '2026-03-01T10:00:00.000Z' }),
    ]
    const metric = scoreReliability([], [], bills)
    expect(metric.included).toBe(true)
    expect(metric.score).toBe(100)
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test`
Expected: FAIL — `isBackfilledPayment is not exported`.

- [ ] **Step 3: Implement it**

Append to `src/features/finance/financeUtils.ts`, extending imports:

```ts
import type { PaymentRecord } from '../loans/loanTypes'
import type { BillPaymentRecord } from '../bills/billTypes'
import { paymentSchedule } from '../loans/loanUtils'
import { daysBetween } from '../../utils/dateUtils'

/** paidAt records when the user tapped the button, not when money moved, so the lag is systematic and always late. */
const GRACE_DAYS = 3

const MIN_EVIDENCE = 3

/**
 * migrateExistingPayments (loanStore.ts) backfills records for loans that
 * predate the payments feature, writing paidAt as exactly the scheduled date.
 * Counted as evidence they would report a flawless on-time history for every
 * migrated loan. A real record comes from new Date() at tap time and will not
 * match the schedule to the millisecond.
 */
export function isBackfilledPayment(payment: PaymentRecord, loan: Loan): boolean {
  const scheduled = paymentSchedule(loan)[payment.month - 1]
  if (scheduled) return scheduled.date.toISOString() === payment.paidAt
  // The migration falls back to the loan start date when the schedule is short.
  return new Date(loan.startDate).toISOString() === payment.paidAt
}

function isOnTime(dueDate: string, paidAt: string): boolean {
  // daysBetween normalises both sides to local midnight, matching how
  // isBillOverdue already compares an ISO date against a timestamp.
  return daysBetween(dueDate, paidAt) <= GRACE_DAYS
}

export function scoreReliability(
  loans: Loan[],
  payments: PaymentRecord[],
  billPayments: BillPaymentRecord[],
): MetricScore {
  const base = { key: 'paymentReliability', label: 'Payment Reliability', weight: 15 } as const

  const loansById = new Map(loans.map((l) => [l.id, l]))
  const realLoanPayments = payments.filter((p) => {
    const loan = loansById.get(p.loanId)
    return loan ? !isBackfilledPayment(p, loan) : true
  })

  // Bills shipped with recordBillPayment and were never backfilled, so all count.
  const evidence: Array<{ dueDate: string; paidAt: string }> = [
    ...realLoanPayments.map((p) => ({ dueDate: p.dueDate, paidAt: p.paidAt })),
    ...billPayments.map((p) => ({ dueDate: p.dueDate, paidAt: p.paidAt })),
  ]

  if (evidence.length < MIN_EVIDENCE) {
    return {
      ...base,
      score: 0,
      detail: 'Not enough payment history yet',
      included: false,
      omissionReason: `Needs at least ${MIN_EVIDENCE} recorded payments`,
    }
  }

  const onTime = evidence.filter((e) => isOnTime(e.dueDate, e.paidAt)).length

  return {
    ...base,
    score: Math.round((onTime / evidence.length) * 100),
    detail: `${onTime} of ${evidence.length} payments on time`,
    included: true,
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test`
Expected: PASS. `2/3 on time` rounds to 67, not 66.

Run: `npm run build`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/finance/financeUtils.ts src/features/finance/financeUtils.test.ts
git commit -m "Score payment reliability, excluding backfilled records"
```

---

### Task 5: Aggregate the metrics into a health score

**Files:**
- Modify: `src/features/finance/financeUtils.ts`
- Test: `src/features/finance/financeUtils.test.ts`

**Interfaces:**
- Consumes: all four metric scorers from Tasks 3-4.
- Produces: `buildHealthScore(overview: FinancialOverview, loans: Loan[], payments: PaymentRecord[], billPayments: BillPaymentRecord[]): HealthScore`.

- [ ] **Step 1: Write the failing tests**

Append to `src/features/finance/financeUtils.test.ts`, extending the import from `./financeUtils` to include `buildHealthScore` and `bandFor`:

```ts
describe('buildHealthScore', () => {
  it('matches the worked example from the spec', () => {
    const overview = buildOverview({
      loans: [makeLoanPaying(4662)],
      bills: [makeBill({ amount: 2800 })],
      goals: [makeGoal({ currentAmount: 500 })],
      monthlyIncome: 20000,
    })

    const health = buildHealthScore(overview, [], [], [])

    const byKey = Object.fromEntries(health.metrics.map((m) => [m.key, m]))
    expect(byKey.debtLoad.score).toBe(69)
    expect(byKey.cashFlow.score).toBe(90)
    expect(byKey.savingsBuffer.score).toBe(2)
    expect(byKey.paymentReliability.included).toBe(false)

    // (69*30 + 90*25 + 2*30) / 85 = 51.53 -> 52
    expect(health.score).toBe(52)
    expect(health.band).toBe('needs-attention')
    expect(health.label).toBe('Needs Attention')
    expect(health.suppressed).toBe(false)
  })

  it('renormalises over the remaining weight when a metric is omitted', () => {
    // Reliability omitted; the other three carry 85 points of weight between them.
    const overview = buildOverview({ loans: [], bills: [], goals: [], monthlyIncome: 20000 })
    const health = buildHealthScore(overview, [], [], [])
    const included = health.metrics.filter((m) => m.included)
    const expected = Math.round(
      included.reduce((sum, m) => sum + m.score * m.weight, 0) / included.reduce((sum, m) => sum + m.weight, 0),
    )
    expect(health.score).toBe(expected)
  })

  it('suppresses the score entirely when there is no income', () => {
    const overview = buildOverview({ loans: [makeLoan()], bills: [], goals: [], monthlyIncome: 0 })
    const health = buildHealthScore(overview, [], [], [])
    expect(health.suppressed).toBe(true)
    expect(health.score).toBe(0)
  })

  it('always returns all four metrics, included or not', () => {
    const overview = buildOverview({ loans: [], bills: [], goals: [], monthlyIncome: 0 })
    expect(buildHealthScore(overview, [], [], []).metrics).toHaveLength(4)
  })

  it('never returns a negative score when over-committed', () => {
    const overview = buildOverview({
      loans: [makeLoanPaying(9000)],
      bills: [makeBill({ amount: 6000 })],
      goals: [],
      monthlyIncome: 10000,
    })
    const health = buildHealthScore(overview, [], [], [])
    expect(health.score).toBeGreaterThanOrEqual(0)
    expect(health.band).toBe('at-risk')
  })

  it('maps scores to bands at their edges', () => {
    expect(bandFor(0)).toBe('at-risk')
    expect(bandFor(39)).toBe('at-risk')
    expect(bandFor(40)).toBe('needs-attention')
    expect(bandFor(59)).toBe('needs-attention')
    expect(bandFor(60)).toBe('stable')
    expect(bandFor(79)).toBe('stable')
    expect(bandFor(80)).toBe('healthy')
    expect(bandFor(100)).toBe('healthy')
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test`
Expected: FAIL — `buildHealthScore is not exported`.

- [ ] **Step 3: Implement it**

Append to `src/features/finance/financeUtils.ts`, extending the type import to include `HealthScore` and `ScoreBandName`:

```ts
const BAND_LABELS: Record<ScoreBandName, string> = {
  'at-risk': 'At Risk',
  'needs-attention': 'Needs Attention',
  stable: 'Stable',
  healthy: 'Healthy',
}

export function bandFor(score: number): ScoreBandName {
  if (score < 40) return 'at-risk'
  if (score < 60) return 'needs-attention'
  if (score < 80) return 'stable'
  return 'healthy'
}

export function buildHealthScore(
  overview: FinancialOverview,
  loans: Loan[],
  payments: PaymentRecord[],
  billPayments: BillPaymentRecord[],
): HealthScore {
  const metrics: MetricScore[] = [
    scoreDebtLoad(overview),
    scoreCashFlow(overview),
    scoreSavingsBuffer(overview),
    scoreReliability(loans, payments, billPayments),
  ]

  // Without income, Debt Load and Cash Flow both drop out — 55 of 100 points.
  // A number built from the remainder would mislead, so publish no number.
  if (overview.monthlyIncome <= 0) {
    return { score: 0, band: 'at-risk', label: BAND_LABELS['at-risk'], metrics, suppressed: true }
  }

  const included = metrics.filter((m) => m.included)
  const totalWeight = included.reduce((sum, m) => sum + m.weight, 0)

  // Metric scores are already rounded. Aggregating from the rounded values —
  // rather than from full precision — costs at most a point but lets the user
  // add up the breakdown on screen and arrive at the number on screen.
  const weighted = included.reduce((sum, m) => sum + m.score * m.weight, 0)
  const score = totalWeight > 0 ? Math.max(0, Math.min(100, Math.round(weighted / totalWeight))) : 0
  const band = bandFor(score)

  return { score, band, label: BAND_LABELS[band], metrics, suppressed: false }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test`
Expected: PASS. The worked example must be exactly 52 — if it comes out 51, metrics are being weighted at full precision instead of rounded first.

Run: `npm run build`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/finance/financeUtils.ts src/features/finance/financeUtils.test.ts
git commit -m "Aggregate metrics into a weighted financial health score"
```

---

### Task 6: Compose the stores behind a hook

**Files:**
- Create: `src/features/finance/useFinancialOverview.ts`

**Interfaces:**
- Consumes: `buildOverview`, `buildHealthScore` from `./financeUtils`; `useLoanStore`, `useBillStore`, `useSavingsStore`, `useIncomeStore`.
- Produces: `useFinancialOverview(): { overview: FinancialOverview; health: HealthScore }`.

- [ ] **Step 1: Write the hook**

Create `src/features/finance/useFinancialOverview.ts`:

```ts
import { useMemo } from 'react'
import { useLoanStore } from '../loans/loanStore'
import { useBillStore } from '../bills/billStore'
import { useSavingsStore } from '../savings/savingsStore'
import { useIncomeStore } from './incomeStore'
import { buildOverview, buildHealthScore } from './financeUtils'
import type { FinancialOverview, HealthScore } from './financeTypes'

export function useFinancialOverview(): { overview: FinancialOverview; health: HealthScore } {
  const { loans, payments } = useLoanStore()
  const { bills, billPayments } = useBillStore()
  const { goals } = useSavingsStore()
  const { monthlyIncome } = useIncomeStore()

  return useMemo(() => {
    const overview = buildOverview({ loans, bills, goals, monthlyIncome })
    const health = buildHealthScore(overview, loans, payments, billPayments)
    return { overview, health }
  }, [loans, payments, bills, billPayments, goals, monthlyIncome])
}
```

No test — this is store wiring with no logic of its own; everything it calls is covered by Tasks 2-5.

- [ ] **Step 2: Verify it compiles**

Run: `npm run build`
Expected: PASS. Unused-import errors here mean a store's exported name differs — check `billStore.ts:40-41` for `bills`/`billPayments` and `savingsStore.ts:37` for `goals`.

- [ ] **Step 3: Commit**

```bash
git add src/features/finance/useFinancialOverview.ts
git commit -m "Add the useFinancialOverview hook composing all four stores"
```

---

### Task 7: Surface the score on the home screen

**Files:**
- Create: `src/features/finance/HealthScoreCard.tsx`
- Modify: `src/components/SummaryHeader.tsx`
- Modify: `src/pages/Dashboard.tsx:126-138`

**Interfaces:**
- Consumes: `useFinancialOverview` (called in `Dashboard`), types `FinancialOverview` and `HealthScore`.
- Produces: `<HealthScoreCard overview={...} health={...} />`.

- [ ] **Step 1: Build the card**

Create `src/features/finance/HealthScoreCard.tsx`. It renders on the dark `BRAND_GRADIENT` header, so it follows the same translucent-white treatment as the existing stat tiles in `SummaryHeader` (`bg-white/[0.13]`, `border-white/[0.12]`) rather than the light-surface `bg-card` used on Analytics.

```tsx
import { useState } from 'react'
import { Activity, ChevronDown } from 'lucide-react'
import type { FinancialOverview, HealthScore, ScoreBandName } from './financeTypes'
import CurrencyAmount from '../../components/CurrencyAmount'

type Props = {
  overview: FinancialOverview
  health: HealthScore
}

// Reuses the existing status triad from loanUtils.statusClasses. No new status
// color, and the brand green in BRAND_GRADIENT stays an accent, not a status.
const BAND_TEXT: Record<ScoreBandName, string> = {
  'at-risk': 'text-red-300',
  'needs-attention': 'text-brand',
  stable: 'text-emerald-300',
  healthy: 'text-emerald-300',
}

export default function HealthScoreCard({ overview, health }: Props) {
  const [expanded, setExpanded] = useState(false)

  if (health.suppressed) {
    return (
      <div className="mb-4 rounded-2xl bg-white/[0.13] backdrop-blur-sm border border-white/[0.12] p-4">
        <div className="flex items-center gap-2 mb-1">
          <Activity className="w-4 h-4 text-white/70" />
          <span className="text-[11px] font-semibold text-white/60 uppercase tracking-wider">Financial Health</span>
        </div>
        <p className="text-[13px] text-white/70">
          Add your monthly income in Settings to see your health score.
        </p>
      </div>
    )
  }

  return (
    <div className="mb-4 rounded-2xl bg-white/[0.13] backdrop-blur-sm border border-white/[0.12] overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-4 text-left"
        aria-expanded={expanded}
      >
        <div className="flex items-center gap-2 mb-2">
          <Activity className="w-4 h-4 text-white/70" />
          <span className="text-[11px] font-semibold text-white/60 uppercase tracking-wider">Financial Health</span>
          <ChevronDown className={`w-4 h-4 text-white/50 ml-auto transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </div>

        <div className="flex items-baseline gap-2">
          <span className="text-[34px] font-bold font-mono text-white tracking-tight leading-none">{health.score}</span>
          <span className="text-[13px] text-white/50 font-mono">/100</span>
          <span className={`text-[13px] font-bold ml-auto ${BAND_TEXT[health.band]}`}>{health.label}</span>
        </div>

        <p className="text-[12px] text-white/60 mt-2.5">
          Committed <CurrencyAmount value={overview.totalCommitments} />
          {' · '}
          Uncommitted <CurrencyAmount value={overview.uncommitted} />
        </p>
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-2 border-t border-white/[0.08] pt-3">
          {health.metrics.map((metric) => (
            <div key={metric.key} className="flex items-baseline gap-2">
              <div className="flex-1 min-w-0">
                <p className={`text-[12px] font-semibold ${metric.included ? 'text-white/85' : 'text-white/40'}`}>
                  {metric.label}
                </p>
                <p className={`text-[11px] ${metric.included ? 'text-white/50' : 'text-white/30'}`}>
                  {metric.included ? metric.detail : metric.omissionReason}
                </p>
              </div>
              <span className={`text-[13px] font-bold font-mono ${metric.included ? 'text-white' : 'text-white/30'}`}>
                {metric.included ? `${metric.score}` : '—'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

The copy says **Uncommitted**, never "Available" — see Global Constraints.

- [ ] **Step 2: Render it from `SummaryHeader`**

In `src/components/SummaryHeader.tsx`, add to the `Props` type:

```ts
  overview: FinancialOverview
  health: HealthScore
```

and these imports:

```ts
import type { FinancialOverview, HealthScore } from '../features/finance/financeTypes'
import HealthScoreCard from '../features/finance/HealthScoreCard'
```

Add `overview` and `health` to the destructured parameter list, then render the card immediately after the closing `</div>` of the Lendy logo block (the `flex items-center gap-3 mb-5` div) and before the `{overdueCount > 0 && (` block:

```tsx
        <HealthScoreCard overview={overview} health={health} />
```

The score goes above the overdue banner because it is the framing for everything below it; the overdue alert stays directly above the payment tiles it refers to.

- [ ] **Step 3: Wire it from `Dashboard`**

In `src/pages/Dashboard.tsx`, add the import:

```ts
import { useFinancialOverview } from '../features/finance/useFinancialOverview'
```

Add near the other hooks at the top of the component:

```ts
  const { overview, health } = useFinancialOverview()
```

And pass both to `SummaryHeader` (around line 127):

```tsx
        overview={overview}
        health={health}
```

`Dashboard` already calls `useIncomeStore()` from Task 1 for `debtToIncome`/`hasIncome`. Leave those props as they are — the existing DTI tile keeps working, and removing it is out of scope.

- [ ] **Step 4: Verify build, lint and tests**

Run: `npm run build`
Expected: PASS.

Run: `npm run lint`
Expected: PASS.

Run: `npm test`
Expected: PASS, all tests from Tasks 2-5.

- [ ] **Step 5: Verify in the running app**

Run: `npm run dev`

1. With income set to 20000 and real loans/bills/savings present, `/` shows the score above the loans list, with a band label and `Committed … · Uncommitted …`.
2. Tap the card — it expands to four metrics. Payment Reliability shows "—" with its omission reason if there is not enough real history.
3. Go to Settings, clear monthly income, return to `/`. The card must show the set-your-income prompt and no number.
4. Set income back to 20000. The score returns.
5. Confirm the loans list, filters and sort below the header are unchanged.

- [ ] **Step 6: Commit**

```bash
git add src/features/finance/HealthScoreCard.tsx src/components/SummaryHeader.tsx src/pages/Dashboard.tsx
git commit -m "Show the financial health score on the home screen"
```

---

## Done criteria

- `npm run build`, `npm run lint` and `npm test` all pass.
- A backup exported before Task 1 restores with income intact.
- `/` shows the score; clearing income suppresses it and shows the prompt.
- `grep -rn "Available" src/features/finance/` returns nothing.
