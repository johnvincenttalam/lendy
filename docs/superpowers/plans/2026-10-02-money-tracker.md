# Money Tracker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a basic income and expense ledger (one-off entries, preset + custom categories, monthly summary with a per-category expense breakdown) under the More tab, fully separate from loans, bills, savings and the health score.

**Architecture:** A new `src/features/money/` folder following the Savings feature's pattern: pure logic in `moneyUtils.ts` (unit tested, no localStorage), a zustand store persisted to localStorage, and React components. Only *custom* categories are persisted; the built-in presets live in code, so they can never go missing or be deleted. Backup import/export is extended with optional money keys.

**Tech Stack:** React, TypeScript, zustand, react-router (HashRouter), Tailwind, lucide-react, vitest.

**Spec:** `docs/superpowers/specs/2026-10-02-money-tracker-design.md`

## Global Constraints

- Entries are one-off only. No recurring entries, budgets, search, or linking to loans/bills/savings.
- The existing `monthlyIncome` setting (`incomeStore.ts`) and the health score (`financeUtils.ts`) are NOT touched.
- Storage keys: `loan-tracker-money-entries`, `loan-tracker-money-categories`.
- Built-in expense categories: Food, Transport, Shopping, Health, Entertainment, Education, Other. Built-in income categories: Salary, Business, Gift, Other. Built-ins cannot be deleted or renamed.
- Deleting a custom category reassigns its entries to that type's built-in "Other"; entries are never deleted or orphaned.
- Amount must be > 0. Future dates are allowed.
- Category names: trimmed, non-empty, unique within a type (case-insensitive).
- Restoring a backup with no money keys must leave existing money data untouched.
- The bottom-nav global Add button and the bottom tabs are unchanged. The page is reached from the More tab at `/money`.
- Amounts render with the existing `CurrencyAmount` component (`formatCurrency` is PHP).
- Page headers use `BRAND_GRADIENT` from `src/constants/styles.ts`.
- Commit messages end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

## Review Focus

- Entry dated on the last/first day of a month (`2026-03-31`, `2026-04-01`) must land in the right month — tested in Task 1 (month filtering uses the `YYYY-MM` prefix, never `new Date()` parsing, which shifts days across timezones).
- A month with only income, only expenses, or nothing: totals and breakdown must not divide by zero — tested in Task 1.
- An entry whose `categoryId` no longer exists (e.g. a restored backup with entries but not the custom categories) must still render, falling back to "Other" — tested in Task 1.
- Garbage inside a backup (entries missing fields, negative/zero/non-numeric amounts, malformed dates, categories colliding with built-in ids) must be dropped, not crash or poison totals — tested in Task 1.
- A backup with no money keys at all must report "nothing to restore" so the store leaves existing data alone — tested in Task 1.
- Floating-point drift in totals (`0.1 + 0.2`) must round to cents — tested in Task 1.

---

## File Structure

| File | Responsibility |
|---|---|
| `src/features/money/moneyTypes.ts` (create) | `MoneyEntryType`, `MoneyCategory`, `MoneyEntry`, `MoneyEntryFormData` |
| `src/features/money/moneyUtils.ts` (create) | Built-in categories and all pure logic: month helpers, totals, breakdown, grouping, category resolution/reassignment/validation, backup parsing |
| `src/features/money/moneyUtils.test.ts` (create) | Unit tests for the above |
| `src/features/money/moneyIcons.ts` (create) | Icon key → lucide icon map, `getCategoryIcon` |
| `src/features/money/moneyStore.ts` (create) | zustand store + localStorage persistence + `importBackup` |
| `src/utils/backup.ts` (modify) | Export/import money data; counts |
| `src/pages/SettingsPage.tsx` (modify) | Mention money entries in the restore confirmation text |
| `src/features/money/Sheet.tsx` (create) | Bottom-sheet shell shared by the form and category manager |
| `src/features/money/ConfirmDialog.tsx` (create) | Small confirm modal matching the app's existing look |
| `src/features/money/MoneyEntryForm.tsx` (create) | Add/edit form with inline "new category" |
| `src/features/money/CategoryManager.tsx` (create) | Rename/delete custom categories |
| `src/pages/MoneyPage.tsx` (create) | The page |
| `src/App.tsx` (modify) | `/money` route |
| `src/pages/MorePage.tsx` (modify) | "Money" row |
| `src/features/whatsNew/changelog.ts` (modify) | 1.6.0 release entry |

---

### Task 1: Types and pure logic (TDD)

**Files:**
- Create: `src/features/money/moneyTypes.ts`
- Create: `src/features/money/moneyUtils.ts`
- Test: `src/features/money/moneyUtils.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces (used by every later task):
  - Types `MoneyEntryType = 'income' | 'expense'`, `MoneyCategory`, `MoneyEntry`, `MoneyEntryFormData`.
  - `DEFAULT_CATEGORIES: MoneyCategory[]`
  - `otherCategoryId(type: MoneyEntryType): string`
  - `allCategories(custom: MoneyCategory[]): MoneyCategory[]`
  - `localISODate(d?: Date): string`
  - `monthKeyOf(date: string): string`
  - `shiftMonth(key: string, delta: number): string`
  - `formatMonthLabel(key: string): string`
  - `entriesForMonth(entries: MoneyEntry[], key: string): MoneyEntry[]`
  - `monthTotals(entries: MoneyEntry[]): { income: number; expenses: number; net: number }`
  - `expenseBreakdown(entries: MoneyEntry[]): CategoryShare[]` where `CategoryShare = { categoryId: string; total: number; share: number }`
  - `groupByDay(entries: MoneyEntry[]): { date: string; entries: MoneyEntry[] }[]`
  - `resolveCategory(categories: MoneyCategory[], entry: Pick<MoneyEntry,'type'|'categoryId'>): MoneyCategory`
  - `reassignEntries(entries: MoneyEntry[], fromId: string, toId: string): MoneyEntry[]`
  - `validateCategoryName(name: string, type: MoneyEntryType, categories: MoneyCategory[], ignoreId?: string): string | null`
  - `parseMoneyBackup(json: string): { entries: MoneyEntry[]; categories: MoneyCategory[] } | null`

- [ ] **Step 1: Create the types**

Create `src/features/money/moneyTypes.ts`:

```ts
export type MoneyEntryType = 'income' | 'expense'

export type MoneyCategory = {
  id: string
  /** A category belongs to exactly one type. */
  type: MoneyEntryType
  name: string
  /** Key into MONEY_ICONS (moneyIcons.ts). */
  icon: string
  builtIn: boolean
}

export type MoneyEntry = {
  id: string
  type: MoneyEntryType
  /** Always > 0; the sign is implied by `type`. */
  amount: number
  categoryId: string
  /** Local calendar date, YYYY-MM-DD. */
  date: string
  note?: string
  createdAt: string
}

export type MoneyEntryFormData = Omit<MoneyEntry, 'id' | 'createdAt'>
```

- [ ] **Step 2: Write the failing tests**

Create `src/features/money/moneyUtils.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import {
  DEFAULT_CATEGORIES,
  otherCategoryId,
  allCategories,
  monthKeyOf,
  shiftMonth,
  formatMonthLabel,
  entriesForMonth,
  monthTotals,
  expenseBreakdown,
  groupByDay,
  resolveCategory,
  reassignEntries,
  validateCategoryName,
  parseMoneyBackup,
} from './moneyUtils'
import type { MoneyEntry, MoneyCategory } from './moneyTypes'

let seq = 0
function makeEntry(overrides: Partial<MoneyEntry> = {}): MoneyEntry {
  seq += 1
  return {
    id: 'e' + seq,
    type: 'expense',
    amount: 100,
    categoryId: 'exp-food',
    date: '2026-03-15',
    createdAt: `2026-03-15T00:00:${String(seq % 60).padStart(2, '0')}.000Z`,
    ...overrides,
  }
}

function makeCategory(overrides: Partial<MoneyCategory> = {}): MoneyCategory {
  return { id: 'c1', type: 'expense', name: 'Pets', icon: 'paw', builtIn: false, ...overrides }
}

describe('built-in categories', () => {
  it('has the agreed presets and an Other for each type', () => {
    const names = (t: 'income' | 'expense') =>
      DEFAULT_CATEGORIES.filter((c) => c.type === t).map((c) => c.name)
    expect(names('expense')).toEqual(['Food', 'Transport', 'Shopping', 'Health', 'Entertainment', 'Education', 'Other'])
    expect(names('income')).toEqual(['Salary', 'Business', 'Gift', 'Other'])
    expect(DEFAULT_CATEGORIES.every((c) => c.builtIn)).toBe(true)
    expect(otherCategoryId('expense')).toBe('exp-other')
    expect(otherCategoryId('income')).toBe('inc-other')
  })

  it('puts built-ins before custom categories', () => {
    const custom = makeCategory()
    const all = allCategories([custom])
    expect(all.slice(0, DEFAULT_CATEGORIES.length)).toEqual(DEFAULT_CATEGORIES)
    expect(all[all.length - 1]).toBe(custom)
  })
})

describe('month helpers', () => {
  it('reads the month from the date text, never via Date parsing', () => {
    expect(monthKeyOf('2026-03-31')).toBe('2026-03')
    expect(monthKeyOf('2026-04-01')).toBe('2026-04')
  })

  it('shifts across year boundaries', () => {
    expect(shiftMonth('2026-01', -1)).toBe('2025-12')
    expect(shiftMonth('2026-12', 1)).toBe('2027-01')
    expect(shiftMonth('2026-05', 0)).toBe('2026-05')
  })

  it('labels a month', () => {
    expect(formatMonthLabel('2026-10')).toBe('October 2026')
  })

  it('keeps month-end and month-start entries in their own months', () => {
    const entries = [makeEntry({ date: '2026-03-31' }), makeEntry({ date: '2026-04-01' })]
    expect(entriesForMonth(entries, '2026-03')).toHaveLength(1)
    expect(entriesForMonth(entries, '2026-04')).toHaveLength(1)
    expect(entriesForMonth(entries, '2026-05')).toHaveLength(0)
  })
})

describe('monthTotals', () => {
  it('returns zeros for an empty month', () => {
    expect(monthTotals([])).toEqual({ income: 0, expenses: 0, net: 0 })
  })

  it('sums income and expenses and nets them (may be negative)', () => {
    const entries = [
      makeEntry({ type: 'income', amount: 1000, categoryId: 'inc-salary' }),
      makeEntry({ amount: 300 }),
      makeEntry({ amount: 900 }),
    ]
    expect(monthTotals(entries)).toEqual({ income: 1000, expenses: 1200, net: -200 })
  })

  it('rounds to cents so float drift does not leak into the UI', () => {
    const entries = [makeEntry({ amount: 0.1 }), makeEntry({ amount: 0.2 })]
    expect(monthTotals(entries).expenses).toBe(0.3)
  })
})

describe('expenseBreakdown', () => {
  it('returns [] when there are no expenses (income-only month)', () => {
    const entries = [makeEntry({ type: 'income', amount: 500, categoryId: 'inc-salary' })]
    expect(expenseBreakdown(entries)).toEqual([])
    expect(expenseBreakdown([])).toEqual([])
  })

  it('groups expenses by category, largest first, with shares summing to 1', () => {
    const entries = [
      makeEntry({ categoryId: 'exp-food', amount: 100 }),
      makeEntry({ categoryId: 'exp-transport', amount: 300 }),
      makeEntry({ categoryId: 'exp-food', amount: 100 }),
      makeEntry({ type: 'income', categoryId: 'inc-salary', amount: 9999 }),
    ]
    const result = expenseBreakdown(entries)
    expect(result.map((r) => r.categoryId)).toEqual(['exp-transport', 'exp-food'])
    expect(result[0]).toEqual({ categoryId: 'exp-transport', total: 300, share: 0.6 })
    expect(result[1]).toEqual({ categoryId: 'exp-food', total: 200, share: 0.4 })
  })
})

describe('groupByDay', () => {
  it('groups by date, newest day first, newest entry first within a day', () => {
    const a = makeEntry({ date: '2026-03-10', createdAt: '2026-03-10T08:00:00.000Z' })
    const b = makeEntry({ date: '2026-03-10', createdAt: '2026-03-10T20:00:00.000Z' })
    const c = makeEntry({ date: '2026-03-12' })
    const groups = groupByDay([a, b, c])
    expect(groups.map((g) => g.date)).toEqual(['2026-03-12', '2026-03-10'])
    expect(groups[1].entries.map((e) => e.id)).toEqual([b.id, a.id])
  })
})

describe('resolveCategory', () => {
  const custom = makeCategory({ id: 'c-pets' })
  const cats = allCategories([custom])

  it('finds a category by id', () => {
    expect(resolveCategory(cats, { type: 'expense', categoryId: 'c-pets' })).toBe(custom)
  })

  it('falls back to that type’s Other when the category is unknown', () => {
    expect(resolveCategory(cats, { type: 'expense', categoryId: 'gone' }).id).toBe('exp-other')
    expect(resolveCategory(cats, { type: 'income', categoryId: 'gone' }).id).toBe('inc-other')
  })
})

describe('reassignEntries', () => {
  it('moves only the matching entries and leaves the rest identical', () => {
    const keep = makeEntry({ categoryId: 'exp-food' })
    const move = makeEntry({ categoryId: 'c-pets' })
    const result = reassignEntries([keep, move], 'c-pets', 'exp-other')
    expect(result[0]).toBe(keep)
    expect(result[1]).toEqual({ ...move, categoryId: 'exp-other' })
  })
})

describe('validateCategoryName', () => {
  const cats = allCategories([makeCategory({ id: 'c-pets', name: 'Pets' })])

  it('rejects empty and whitespace-only names', () => {
    expect(validateCategoryName('   ', 'expense', cats)).toBe('Name is required')
  })

  it('rejects a duplicate in the same type, case-insensitively and trimmed', () => {
    expect(validateCategoryName(' pets ', 'expense', cats)).toBe('That category already exists')
    expect(validateCategoryName('FOOD', 'expense', cats)).toBe('That category already exists')
  })

  it('allows the same name in the other type', () => {
    expect(validateCategoryName('Pets', 'income', cats)).toBeNull()
  })

  it('lets a category keep its own name when renaming', () => {
    expect(validateCategoryName('Pets', 'expense', cats, 'c-pets')).toBeNull()
  })
})

describe('parseMoneyBackup', () => {
  it('returns null for an old backup with no money keys, or bad JSON', () => {
    expect(parseMoneyBackup(JSON.stringify({ loans: [] }))).toBeNull()
    expect(parseMoneyBackup('not json')).toBeNull()
  })

  it('keeps valid entries and categories', () => {
    const entry = makeEntry()
    const cat = makeCategory()
    const result = parseMoneyBackup(JSON.stringify({ moneyEntries: [entry], moneyCategories: [cat] }))
    expect(result).toEqual({ entries: [entry], categories: [cat] })
  })

  it('drops malformed entries instead of poisoning totals', () => {
    const good = makeEntry()
    const bad = [
      { ...makeEntry(), amount: 0 },
      { ...makeEntry(), amount: -5 },
      { ...makeEntry(), amount: 'abc' },
      { ...makeEntry(), date: 'March 3' },
      { ...makeEntry(), type: 'transfer' },
      { id: 'x' },
      null,
    ]
    const result = parseMoneyBackup(JSON.stringify({ moneyEntries: [good, ...bad] }))
    expect(result?.entries).toEqual([good])
  })

  it('never lets a backup replace or duplicate a built-in category, and forces builtIn false', () => {
    const sneaky = makeCategory({ id: 'exp-food', name: 'Hacked', builtIn: true })
    const ok = makeCategory({ id: 'c-ok', builtIn: true })
    const result = parseMoneyBackup(JSON.stringify({ moneyCategories: [sneaky, ok] }))
    expect(result?.categories).toEqual([{ ...ok, builtIn: false }])
  })

  it('treats a backup with only one of the two keys as present, defaulting the other to empty', () => {
    const entry = makeEntry()
    expect(parseMoneyBackup(JSON.stringify({ moneyEntries: [entry] }))).toEqual({ entries: [entry], categories: [] })
  })
})
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx vitest run src/features/money/moneyUtils.test.ts`
Expected: FAIL — cannot resolve `./moneyUtils`.

- [ ] **Step 4: Implement `moneyUtils.ts`**

Create `src/features/money/moneyUtils.ts`:

```ts
import type { MoneyCategory, MoneyEntry, MoneyEntryType } from './moneyTypes'

export const DEFAULT_CATEGORIES: MoneyCategory[] = [
  { id: 'exp-food', type: 'expense', name: 'Food', icon: 'utensils', builtIn: true },
  { id: 'exp-transport', type: 'expense', name: 'Transport', icon: 'car', builtIn: true },
  { id: 'exp-shopping', type: 'expense', name: 'Shopping', icon: 'shopping-bag', builtIn: true },
  { id: 'exp-health', type: 'expense', name: 'Health', icon: 'heart-pulse', builtIn: true },
  { id: 'exp-entertainment', type: 'expense', name: 'Entertainment', icon: 'film', builtIn: true },
  { id: 'exp-education', type: 'expense', name: 'Education', icon: 'graduation-cap', builtIn: true },
  { id: 'exp-other', type: 'expense', name: 'Other', icon: 'other', builtIn: true },
  { id: 'inc-salary', type: 'income', name: 'Salary', icon: 'wallet', builtIn: true },
  { id: 'inc-business', type: 'income', name: 'Business', icon: 'briefcase', builtIn: true },
  { id: 'inc-gift', type: 'income', name: 'Gift', icon: 'gift', builtIn: true },
  { id: 'inc-other', type: 'income', name: 'Other', icon: 'other', builtIn: true },
]

export function otherCategoryId(type: MoneyEntryType): string {
  return type === 'income' ? 'inc-other' : 'exp-other'
}

export function allCategories(custom: MoneyCategory[]): MoneyCategory[] {
  return [...DEFAULT_CATEGORIES, ...custom]
}

const round2 = (n: number) => Math.round(n * 100) / 100

/** Today as a LOCAL YYYY-MM-DD. toISOString() would give the UTC date, which is "yesterday" before 8am in the Philippines. */
export function localISODate(d: Date = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** 'YYYY-MM-DD' -> 'YYYY-MM'. Text slicing on purpose: Date parsing shifts days across timezones. */
export function monthKeyOf(date: string): string {
  return date.slice(0, 7)
}

export function shiftMonth(key: string, delta: number): string {
  const [y, m] = key.split('-').map(Number)
  const index = y * 12 + (m - 1) + delta
  const ny = Math.floor(index / 12)
  const nm = (index % 12) + 1
  return `${ny}-${String(nm).padStart(2, '0')}`
}

export function formatMonthLabel(key: string): string {
  const [y, m] = key.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

export function entriesForMonth(entries: MoneyEntry[], key: string): MoneyEntry[] {
  return entries.filter((e) => monthKeyOf(e.date) === key)
}

export function monthTotals(entries: MoneyEntry[]): { income: number; expenses: number; net: number } {
  let income = 0
  let expenses = 0
  for (const e of entries) {
    if (e.type === 'income') income += e.amount
    else expenses += e.amount
  }
  income = round2(income)
  expenses = round2(expenses)
  return { income, expenses, net: round2(income - expenses) }
}

export type CategoryShare = { categoryId: string; total: number; share: number }

export function expenseBreakdown(entries: MoneyEntry[]): CategoryShare[] {
  const totals = new Map<string, number>()
  let grand = 0
  for (const e of entries) {
    if (e.type !== 'expense') continue
    totals.set(e.categoryId, (totals.get(e.categoryId) ?? 0) + e.amount)
    grand += e.amount
  }
  if (grand === 0) return []
  return [...totals.entries()]
    .map(([categoryId, total]) => ({ categoryId, total: round2(total), share: total / grand }))
    .sort((a, b) => b.total - a.total)
}

export function groupByDay(entries: MoneyEntry[]): { date: string; entries: MoneyEntry[] }[] {
  const byDay = new Map<string, MoneyEntry[]>()
  for (const e of entries) {
    const list = byDay.get(e.date)
    if (list) list.push(e)
    else byDay.set(e.date, [e])
  }
  return [...byDay.entries()]
    .sort(([a], [b]) => (a < b ? 1 : a > b ? -1 : 0))
    .map(([date, list]) => ({
      date,
      entries: [...list].sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0)),
    }))
}

/** An entry can point at a category this device has never heard of (restored backup). Those read as "Other". */
export function resolveCategory(
  categories: MoneyCategory[],
  entry: Pick<MoneyEntry, 'type' | 'categoryId'>,
): MoneyCategory {
  const found = categories.find((c) => c.id === entry.categoryId)
  if (found) return found
  const fallback = categories.find((c) => c.id === otherCategoryId(entry.type))
  // DEFAULT_CATEGORIES always contains both Others, so this is unreachable
  // unless the caller passed a list that omitted them.
  return fallback ?? DEFAULT_CATEGORIES.find((c) => c.id === otherCategoryId(entry.type))!
}

export function reassignEntries(entries: MoneyEntry[], fromId: string, toId: string): MoneyEntry[] {
  return entries.map((e) => (e.categoryId === fromId ? { ...e, categoryId: toId } : e))
}

export function validateCategoryName(
  name: string,
  type: MoneyEntryType,
  categories: MoneyCategory[],
  ignoreId?: string,
): string | null {
  const trimmed = name.trim()
  if (!trimmed) return 'Name is required'
  const lower = trimmed.toLowerCase()
  const clash = categories.some(
    (c) => c.type === type && c.id !== ignoreId && c.name.trim().toLowerCase() === lower,
  )
  return clash ? 'That category already exists' : null
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function isValidEntry(x: unknown): x is MoneyEntry {
  if (!x || typeof x !== 'object') return false
  const e = x as Partial<MoneyEntry>
  return (
    typeof e.id === 'string' &&
    (e.type === 'income' || e.type === 'expense') &&
    typeof e.amount === 'number' &&
    Number.isFinite(e.amount) &&
    e.amount > 0 &&
    typeof e.categoryId === 'string' &&
    typeof e.date === 'string' &&
    DATE_RE.test(e.date) &&
    typeof e.createdAt === 'string'
  )
}

const BUILT_IN_IDS = new Set(DEFAULT_CATEGORIES.map((c) => c.id))

function isValidCustomCategory(x: unknown): x is MoneyCategory {
  if (!x || typeof x !== 'object') return false
  const c = x as Partial<MoneyCategory>
  return (
    typeof c.id === 'string' &&
    !BUILT_IN_IDS.has(c.id) &&
    (c.type === 'income' || c.type === 'expense') &&
    typeof c.name === 'string' &&
    c.name.trim().length > 0 &&
    typeof c.icon === 'string'
  )
}

/**
 * Pulls money data out of a backup. Returns null when the backup has neither
 * money key (an older backup) so the caller can leave existing data alone.
 */
export function parseMoneyBackup(json: string): { entries: MoneyEntry[]; categories: MoneyCategory[] } | null {
  let data: unknown
  try {
    data = JSON.parse(json)
  } catch {
    return null
  }
  if (!data || typeof data !== 'object') return null
  const { moneyEntries, moneyCategories } = data as { moneyEntries?: unknown; moneyCategories?: unknown }
  if (!Array.isArray(moneyEntries) && !Array.isArray(moneyCategories)) return null

  const entries = Array.isArray(moneyEntries) ? moneyEntries.filter(isValidEntry) : []
  const categories = Array.isArray(moneyCategories)
    ? moneyCategories.filter(isValidCustomCategory).map((c) => ({ ...c, builtIn: false }))
    : []
  return { entries, categories }
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/features/money/moneyUtils.test.ts`
Expected: PASS (all tests).

- [ ] **Step 6: Commit**

```bash
git add src/features/money/moneyTypes.ts src/features/money/moneyUtils.ts src/features/money/moneyUtils.test.ts
git commit -m "Add money tracker types and pure logic

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Icons, store and backup

**Files:**
- Create: `src/features/money/moneyIcons.ts`
- Create: `src/features/money/moneyStore.ts`
- Modify: `src/utils/backup.ts`
- Modify: `src/pages/SettingsPage.tsx`

**Interfaces:**
- Consumes: everything from Task 1.
- Produces:
  - `MONEY_ICONS: Record<string, LucideIcon>`, `ICON_KEYS: string[]` (the custom-category picker choices), `getCategoryIcon(key: string): LucideIcon`
  - `useMoneyStore` with state `entries: MoneyEntry[]`, `customCategories: MoneyCategory[]` and actions:
    - `addEntry(data: MoneyEntryFormData): void`
    - `updateEntry(id: string, data: MoneyEntryFormData): void`
    - `deleteEntry(id: string): void`
    - `addCategory(type: MoneyEntryType, name: string, icon: string): string | null` (returns new id, or null if the name is invalid)
    - `renameCategory(id: string, name: string): boolean`
    - `deleteCategory(id: string): void`
    - `importBackup(json: string): void`
  - `BackupCounts` gains `moneyEntries: number`.

(Store and backup are verified by `tsc` and the full test run; the pure logic they delegate to is already tested in Task 1. The store reads `localStorage` at import, so it is deliberately not imported by any test.)

- [ ] **Step 1: Create the icon map**

Create `src/features/money/moneyIcons.ts`:

```ts
import {
  Utensils, Car, ShoppingBag, HeartPulse, Film, GraduationCap, Wallet, Briefcase, Gift,
  CircleEllipsis, House, Coffee, Smartphone, Plane, Dumbbell, PawPrint, Shirt, Fuel, TrendingUp,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

/**
 * Keyed by string, not by index, and stored on the category by key: a restored
 * backup can name an icon this build lacks, so lookups fall back (see below).
 */
export const MONEY_ICONS: Record<string, LucideIcon> = {
  utensils: Utensils,
  car: Car,
  'shopping-bag': ShoppingBag,
  'heart-pulse': HeartPulse,
  film: Film,
  'graduation-cap': GraduationCap,
  wallet: Wallet,
  briefcase: Briefcase,
  gift: Gift,
  other: CircleEllipsis,
  house: House,
  coffee: Coffee,
  smartphone: Smartphone,
  plane: Plane,
  dumbbell: Dumbbell,
  paw: PawPrint,
  shirt: Shirt,
  fuel: Fuel,
  'trending-up': TrendingUp,
}

/** What a user can pick for a custom category. */
export const ICON_KEYS = ['house', 'coffee', 'smartphone', 'plane', 'dumbbell', 'paw', 'shirt', 'fuel', 'trending-up', 'gift', 'wallet', 'other']

export function getCategoryIcon(key: string): LucideIcon {
  return MONEY_ICONS[key] ?? CircleEllipsis
}
```

- [ ] **Step 2: Create the store**

Create `src/features/money/moneyStore.ts`:

```ts
import { create } from 'zustand'
import type { MoneyCategory, MoneyEntry, MoneyEntryFormData, MoneyEntryType } from './moneyTypes'
import { allCategories, otherCategoryId, parseMoneyBackup, reassignEntries, validateCategoryName } from './moneyUtils'
import { showToast } from '../../components/Toast'

const ENTRIES_KEY = 'loan-tracker-money-entries'
const CATEGORIES_KEY = 'loan-tracker-money-categories'

function load<T>(key: string): T[] {
  try {
    const data = localStorage.getItem(key)
    const parsed = data ? JSON.parse(data) : []
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function saveEntries(entries: MoneyEntry[]) {
  localStorage.setItem(ENTRIES_KEY, JSON.stringify(entries))
}

function saveCategories(categories: MoneyCategory[]) {
  localStorage.setItem(CATEGORIES_KEY, JSON.stringify(categories))
}

type MoneyStore = {
  entries: MoneyEntry[]
  /** Custom categories only. Built-ins live in code (DEFAULT_CATEGORIES) and are never persisted. */
  customCategories: MoneyCategory[]
  addEntry: (data: MoneyEntryFormData) => void
  updateEntry: (id: string, data: MoneyEntryFormData) => void
  deleteEntry: (id: string) => void
  addCategory: (type: MoneyEntryType, name: string, icon: string) => string | null
  renameCategory: (id: string, name: string) => boolean
  deleteCategory: (id: string) => void
  importBackup: (json: string) => void
}

export const useMoneyStore = create<MoneyStore>((set, get) => ({
  entries: load<MoneyEntry>(ENTRIES_KEY),
  customCategories: load<MoneyCategory>(CATEGORIES_KEY),

  addEntry: (data) =>
    set((state) => {
      const entry: MoneyEntry = { ...data, id: crypto.randomUUID(), createdAt: new Date().toISOString() }
      const entries = [...state.entries, entry]
      saveEntries(entries)
      showToast(data.type === 'income' ? 'Income added' : 'Expense added')
      return { entries }
    }),

  updateEntry: (id, data) =>
    set((state) => {
      const entries = state.entries.map((e) => (e.id === id ? { ...e, ...data } : e))
      saveEntries(entries)
      return { entries }
    }),

  deleteEntry: (id) =>
    set((state) => {
      const entries = state.entries.filter((e) => e.id !== id)
      saveEntries(entries)
      showToast('Entry deleted')
      return { entries }
    }),

  addCategory: (type, name, icon) => {
    const categories = allCategories(get().customCategories)
    if (validateCategoryName(name, type, categories) !== null) return null
    const category: MoneyCategory = { id: crypto.randomUUID(), type, name: name.trim(), icon, builtIn: false }
    const customCategories = [...get().customCategories, category]
    saveCategories(customCategories)
    set({ customCategories })
    return category.id
  },

  renameCategory: (id, name) => {
    const target = get().customCategories.find((c) => c.id === id)
    if (!target) return false
    if (validateCategoryName(name, target.type, allCategories(get().customCategories), id) !== null) return false
    const customCategories = get().customCategories.map((c) => (c.id === id ? { ...c, name: name.trim() } : c))
    saveCategories(customCategories)
    set({ customCategories })
    return true
  },

  deleteCategory: (id) =>
    set((state) => {
      const target = state.customCategories.find((c) => c.id === id)
      if (!target) return state
      const customCategories = state.customCategories.filter((c) => c.id !== id)
      // Move, never drop: the user's history must survive losing a label.
      const entries = reassignEntries(state.entries, id, otherCategoryId(target.type))
      saveCategories(customCategories)
      saveEntries(entries)
      showToast(`"${target.name}" deleted`)
      return { customCategories, entries }
    }),

  importBackup: (json) => {
    const parsed = parseMoneyBackup(json)
    // null = an older backup without money data. Leave what's on the device alone.
    if (!parsed) return
    saveEntries(parsed.entries)
    saveCategories(parsed.categories)
    set({ entries: parsed.entries, customCategories: parsed.categories })
  },
}))
```

- [ ] **Step 3: Extend backup export/import**

In `src/utils/backup.ts`:

1. Add the import next to the other store imports:

```ts
import { useMoneyStore } from '../features/money/moneyStore'
```

2. In `exportAllData`, after the `const { goals, transactions } = ...` line add `const { entries: moneyEntries, customCategories: moneyCategories } = useMoneyStore.getState()`, and add `moneyEntries,` and `moneyCategories,` to the object passed to `JSON.stringify` (before `exportedAt`).

3. Replace the `BackupCounts` type and `parseBackupCounts` return with:

```ts
export type BackupCounts = { loans: number; bills: number; savingsGoals: number; moneyEntries: number }
```

and in `parseBackupCounts`, add to the returned object:

```ts
      moneyEntries: Array.isArray(data.moneyEntries) ? data.moneyEntries.length : 0,
```

4. In `importAllData`, after `useSavingsStore.getState().importBackup(json)` add:

```ts
  useMoneyStore.getState().importBackup(json)
```

5. In `describeRestoredCounts`, after the savings line add:

```ts
  if (counts.moneyEntries > 0) parts.push(describeCount(counts.moneyEntries, 'money entry').replace('money entrys', 'money entries'))
```

(`describeCount` pluralises by appending "s", which would give "money entrys"; the `replace` fixes only that one word.)

- [ ] **Step 4: Mention money entries in the Settings restore text**

In `src/pages/SettingsPage.tsx`, in `describeBackupImport`, after the `savingsGoals` line add:

```ts
  if (incoming.moneyEntries > 0) parts.push(describeCount(incoming.moneyEntries, 'money entry').replace('money entrys', 'money entries'))
```

- [ ] **Step 5: Type-check and run all tests**

Run: `npx tsc -b --noEmit` (if that script is unavailable use `npx tsc --noEmit -p tsconfig.app.json`)
Expected: no errors. If a lucide icon import errors as missing, replace it with another icon from `lucide-react` and keep the same key in `MONEY_ICONS`.

Run: `npm test`
Expected: all tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/features/money/moneyIcons.ts src/features/money/moneyStore.ts src/utils/backup.ts src/pages/SettingsPage.tsx
git commit -m "Add money store, icons and backup support

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Shared sheet and confirm components

**Files:**
- Create: `src/features/money/Sheet.tsx`
- Create: `src/features/money/ConfirmDialog.tsx`

**Interfaces:**
- Consumes: `useBodyScrollLock` from `src/hooks/useBodyScrollLock.ts`.
- Produces:
  - `<Sheet title: string onClose: () => void footer?: ReactNode>{children}</Sheet>`
  - `<ConfirmDialog title: string message: string confirmLabel: string onConfirm: () => void onCancel: () => void />`

- [ ] **Step 1: Create `Sheet.tsx`**

The shell mirrors `BillForm`'s markup (without the drag-to-close handle, which is not needed here):

```tsx
import { X } from 'lucide-react'
import type { ReactNode } from 'react'
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock'

type Props = {
  title: string
  onClose: () => void
  /** Pinned below the scrolling body. */
  footer?: ReactNode
  children: ReactNode
}

export default function Sheet({ title, onClose, footer, children }: Props) {
  useBodyScrollLock(true)

  return (
    <div className="fixed inset-0 bg-overlay z-50 flex items-end sm:items-center justify-center animate-fade-in">
      <div className="bg-card w-full h-full sm:h-auto sm:max-w-lg sm:rounded-2xl rounded-none sm:max-h-[92vh] flex flex-col overflow-hidden border-0 sm:border border-themed animate-slide-up">
        <div className="shrink-0 flex items-center justify-between px-5 pt-5 pb-4 border-b border-divider sm:border-b-0">
          <h2 className="text-[20px] font-bold text-primary tracking-tight">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="w-8 h-8 flex items-center justify-center hover:opacity-60 transition-opacity">
            <X className="w-[18px] h-[18px] text-secondary" />
          </button>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto custom-scroll px-5 pt-1 pb-5 space-y-4">{children}</div>
        {footer && (
          <div className="shrink-0 border-t border-divider px-5 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">{footer}</div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create `ConfirmDialog.tsx`** (same look as the confirm modal in `BillDetails.tsx`)

```tsx
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock'

type Props = {
  title: string
  message: string
  confirmLabel: string
  onConfirm: () => void
  onCancel: () => void
}

export default function ConfirmDialog({ title, message, confirmLabel, onConfirm, onCancel }: Props) {
  useBodyScrollLock(true)

  return (
    <div className="fixed inset-0 bg-overlay z-[60] flex items-center justify-center p-5 animate-fade-in">
      <div className="bg-card rounded-2xl p-6 max-w-[320px] w-full border border-themed transition-colors animate-scale-in">
        <h3 className="font-bold text-primary text-[18px] tracking-tight mb-2">{title}</h3>
        <p className="text-[13px] text-secondary mb-6">{message}</p>
        <div className="flex gap-2.5">
          <button
            onClick={onCancel}
            className="flex-1 py-3 rounded-xl bg-subtle text-secondary font-semibold text-[14px] hover:opacity-80 transition-opacity"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-3 rounded-xl font-semibold text-[14px] text-white hover:opacity-90 transition-opacity"
            style={{ backgroundColor: '#EF4444' }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit -p tsconfig.app.json`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/features/money/Sheet.tsx src/features/money/ConfirmDialog.tsx
git commit -m "Add shared sheet and confirm dialog for the money feature

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Entry form and category manager

**Files:**
- Create: `src/features/money/MoneyEntryForm.tsx`
- Create: `src/features/money/CategoryManager.tsx`

**Interfaces:**
- Consumes: `Sheet`, `ConfirmDialog` (Task 3); store, utils, icons (Tasks 1–2).
- Produces:
  - `<MoneyEntryForm onSubmit: (data: MoneyEntryFormData) => void onClose: () => void onDelete?: () => void initial?: MoneyEntry />` — `onDelete` is only passed when editing.
  - `<CategoryManager onClose: () => void />`

- [ ] **Step 1: Create `MoneyEntryForm.tsx`**

```tsx
import { useMemo, useState } from 'react'
import { Plus } from 'lucide-react'
import Sheet from './Sheet'
import { useMoneyStore } from './moneyStore'
import { ICON_KEYS, getCategoryIcon } from './moneyIcons'
import { allCategories, localISODate, otherCategoryId, validateCategoryName } from './moneyUtils'
import type { MoneyEntry, MoneyEntryFormData, MoneyEntryType } from './moneyTypes'

type Props = {
  onSubmit: (data: MoneyEntryFormData) => void
  onClose: () => void
  onDelete?: () => void
  initial?: MoneyEntry
}

export default function MoneyEntryForm({ onSubmit, onClose, onDelete, initial }: Props) {
  const isEdit = !!initial
  const { customCategories, addCategory } = useMoneyStore()
  const categories = useMemo(() => allCategories(customCategories), [customCategories])

  const [type, setType] = useState<MoneyEntryType>(initial?.type ?? 'expense')
  const [amount, setAmount] = useState(initial ? String(initial.amount) : '')
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? otherCategoryId('expense'))
  const [date, setDate] = useState(initial?.date ?? localISODate())
  const [note, setNote] = useState(initial?.note ?? '')
  const [errors, setErrors] = useState<Record<string, string>>({})

  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [newIcon, setNewIcon] = useState(ICON_KEYS[0])

  const typeCategories = categories.filter((c) => c.type === type)

  function switchType(next: MoneyEntryType) {
    if (next === type) return
    setType(next)
    // A category belongs to one type, so the old pick is meaningless now.
    setCategoryId(otherCategoryId(next))
    setCreating(false)
  }

  function clearError(field: string) {
    setErrors((prev) => {
      if (!(field in prev)) return prev
      const next = { ...prev }
      delete next[field]
      return next
    })
  }

  function handleCreateCategory() {
    const problem = validateCategoryName(newName, type, categories)
    if (problem) {
      setErrors((prev) => ({ ...prev, newCategory: problem }))
      return
    }
    const id = addCategory(type, newName, newIcon)
    if (id) {
      setCategoryId(id)
      setCreating(false)
      setNewName('')
      clearError('newCategory')
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const next: Record<string, string> = {}
    if (!amount || !(Number(amount) > 0)) next.amount = 'Enter a valid amount'
    if (!date) next.date = 'Pick a date'
    setErrors(next)
    if (Object.keys(next).length > 0) return
    onSubmit({
      type,
      amount: Math.round(Number(amount) * 100) / 100,
      categoryId,
      date,
      note: note.trim() || undefined,
    })
  }

  const accent = type === 'income' ? '#3ECF8E' : '#EF4444'

  return (
    <Sheet
      title={isEdit ? 'Edit Entry' : 'New Entry'}
      onClose={onClose}
      footer={
        <div className="space-y-2">
          <button
            type="submit"
            form="money-entry-form"
            className="w-full text-white font-bold py-3.5 rounded-2xl active:scale-[0.98] transition-all duration-200 text-[15px] tracking-tight hover:opacity-90"
            style={{ backgroundColor: accent }}
          >
            {isEdit ? 'Save Changes' : type === 'income' ? 'Add Income' : 'Add Expense'}
          </button>
          {onDelete && (
            <button
              type="button"
              onClick={onDelete}
              className="w-full py-3 rounded-2xl bg-subtle text-red-500 font-semibold text-[14px] hover:opacity-80 transition-opacity"
            >
              Delete Entry
            </button>
          )}
        </div>
      }
    >
      <form id="money-entry-form" onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-1.5 bg-subtle rounded-full p-1" role="group" aria-label="Entry type">
          {(['expense', 'income'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => switchType(t)}
              aria-pressed={type === t}
              className={`text-[13px] font-semibold py-2 rounded-full transition-all ${
                type === t ? 'bg-card text-primary shadow-sm' : 'text-secondary hover:opacity-80'
              }`}
            >
              {t === 'expense' ? 'Expense' : 'Income'}
            </button>
          ))}
        </div>

        <Field label="Amount (₱)" id="money-amount" error={errors.amount}>
          <input
            id="money-amount"
            type="number"
            step="0.01"
            inputMode="decimal"
            placeholder="0.00"
            value={amount}
            onChange={(e) => { setAmount(e.target.value); clearError('amount') }}
            aria-invalid={!!errors.amount}
            className="input-field"
          />
        </Field>

        <Field label="Category">
          <div className="flex flex-wrap gap-1.5">
            {typeCategories.map((c) => {
              const Icon = getCategoryIcon(c.icon)
              const active = categoryId === c.id
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCategoryId(c.id)}
                  aria-pressed={active}
                  className={`text-[12px] font-semibold px-3 py-1.5 rounded-full transition-all inline-flex items-center gap-1.5 ${
                    active ? 'text-white' : 'bg-subtle text-secondary hover:opacity-80'
                  }`}
                  style={active ? { backgroundColor: accent } : undefined}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {c.name}
                </button>
              )
            })}
            <button
              type="button"
              onClick={() => setCreating((v) => !v)}
              aria-expanded={creating}
              className="text-[12px] font-semibold px-3 py-1.5 rounded-full bg-subtle text-secondary hover:opacity-80 inline-flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              New
            </button>
          </div>

          {creating && (
            <div className="mt-3 rounded-2xl border border-themed p-3 space-y-3">
              <div className={errors.newCategory ? 'rounded-[14px] ring-2 ring-red-500/50' : undefined}>
                <input
                  type="text"
                  value={newName}
                  maxLength={24}
                  onChange={(e) => { setNewName(e.target.value); clearError('newCategory') }}
                  placeholder="Category name"
                  aria-label="New category name"
                  className="input-field"
                />
              </div>
              {errors.newCategory && <p className="text-[11px] text-red-500 dark:text-red-400 font-medium">{errors.newCategory}</p>}
              <div className="flex flex-wrap gap-1.5" role="group" aria-label="Category icon">
                {ICON_KEYS.map((key) => {
                  const Icon = getCategoryIcon(key)
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setNewIcon(key)}
                      aria-pressed={newIcon === key}
                      aria-label={key}
                      className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${
                        newIcon === key ? 'bg-brand text-on-brand' : 'bg-subtle text-secondary hover:opacity-80'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                    </button>
                  )
                })}
              </div>
              <button
                type="button"
                onClick={handleCreateCategory}
                className="w-full py-2.5 rounded-xl bg-brand text-on-brand font-semibold text-[13px] hover:opacity-90"
              >
                Add category
              </button>
            </div>
          )}
        </Field>

        <Field label="Date" id="money-date" error={errors.date}>
          <input
            id="money-date"
            type="date"
            value={date}
            onChange={(e) => { setDate(e.target.value); clearError('date') }}
            className="input-field"
          />
        </Field>

        <Field label="Note" id="money-note">
          <input
            id="money-note"
            type="text"
            value={note}
            maxLength={120}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Optional"
            className="input-field"
          />
        </Field>
      </form>
    </Sheet>
  )
}

function Field({ label, id, error, children }: { label: string; id?: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="block text-[12px] font-semibold text-muted uppercase tracking-wider mb-1.5">{label}</label>
      <div className={error ? 'rounded-[14px] ring-2 ring-red-500/50' : undefined}>{children}</div>
      {error && <p className="text-[11px] text-red-500 dark:text-red-400 mt-1 font-medium">{error}</p>}
    </div>
  )
}
```

- [ ] **Step 2: Create `CategoryManager.tsx`**

```tsx
import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import Sheet from './Sheet'
import ConfirmDialog from './ConfirmDialog'
import { useMoneyStore } from './moneyStore'
import { getCategoryIcon } from './moneyIcons'
import { allCategories, validateCategoryName } from './moneyUtils'
import { showToast } from '../../components/Toast'
import type { MoneyCategory } from './moneyTypes'

type Props = { onClose: () => void }

export default function CategoryManager({ onClose }: Props) {
  const { customCategories, renameCategory, deleteCategory } = useMoneyStore()
  const [pendingDelete, setPendingDelete] = useState<MoneyCategory | null>(null)

  return (
    <>
      <Sheet title="Categories" onClose={onClose}>
        <p className="text-[12px] text-muted">
          Built-in categories can&apos;t be changed. Deleting one of yours moves its entries to Other.
        </p>

        {customCategories.length === 0 ? (
          <p className="text-[13px] text-secondary py-6 text-center">
            No custom categories yet. Add one while creating an entry.
          </p>
        ) : (
          (['expense', 'income'] as const).map((type) => {
            const list = customCategories.filter((c) => c.type === type)
            if (list.length === 0) return null
            return (
              <section key={type}>
                <h3 className="text-[11px] font-semibold text-muted uppercase tracking-wider mb-2">
                  {type === 'expense' ? 'Expense' : 'Income'}
                </h3>
                <ul className="space-y-2">
                  {list.map((c) => (
                    <CategoryRow
                      key={c.id}
                      category={c}
                      onRename={(name) => {
                        const problem = validateCategoryName(name, c.type, allCategories(customCategories), c.id)
                        if (problem) {
                          showToast(problem)
                          return false
                        }
                        return renameCategory(c.id, name)
                      }}
                      onDelete={() => setPendingDelete(c)}
                    />
                  ))}
                </ul>
              </section>
            )
          })
        )}
      </Sheet>

      {pendingDelete && (
        <ConfirmDialog
          title="Delete Category"
          message={`Delete "${pendingDelete.name}"? Its entries will move to Other.`}
          confirmLabel="Delete"
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => {
            deleteCategory(pendingDelete.id)
            setPendingDelete(null)
          }}
        />
      )}
    </>
  )
}

function CategoryRow({
  category,
  onRename,
  onDelete,
}: {
  category: MoneyCategory
  onRename: (name: string) => boolean
  onDelete: () => void
}) {
  const Icon = getCategoryIcon(category.icon)
  const [draft, setDraft] = useState(category.name)

  function commit() {
    if (draft.trim() === category.name) return
    // Rejected renames snap back so the field never shows a name that isn't saved.
    if (!onRename(draft)) setDraft(category.name)
  }

  return (
    <li className="flex items-center gap-3 bg-subtle rounded-2xl px-3 py-2">
      <div className="w-8 h-8 rounded-[10px] bg-brand/10 flex items-center justify-center shrink-0">
        <Icon className="w-4 h-4 text-brand" />
      </div>
      <input
        value={draft}
        maxLength={24}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
        aria-label={`Rename ${category.name}`}
        className="flex-1 min-w-0 bg-transparent text-[14px] font-semibold text-primary outline-none"
      />
      <button
        onClick={onDelete}
        aria-label={`Delete ${category.name}`}
        className="w-8 h-8 flex items-center justify-center text-red-500 hover:opacity-70 transition-opacity"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </li>
  )
}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit -p tsconfig.app.json`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/features/money/MoneyEntryForm.tsx src/features/money/CategoryManager.tsx
git commit -m "Add money entry form and category manager

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Money page, route, More row, changelog

**Files:**
- Create: `src/pages/MoneyPage.tsx`
- Modify: `src/App.tsx` (route + import)
- Modify: `src/pages/MorePage.tsx` (row)
- Modify: `src/features/whatsNew/changelog.ts` (1.6.0)

**Interfaces:**
- Consumes: store (Task 2), utils (Task 1), `MoneyEntryForm` / `CategoryManager` / `ConfirmDialog` (Tasks 3–4), `EmptyState`, `CurrencyAmount`, `BRAND_GRADIENT`.
- Produces: default export `MoneyPage`; route `/money`.

- [ ] **Step 1: Create `MoneyPage.tsx`**

```tsx
import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Plus, Tags, Wallet } from 'lucide-react'
import { useMoneyStore } from '../features/money/moneyStore'
import MoneyEntryForm from '../features/money/MoneyEntryForm'
import CategoryManager from '../features/money/CategoryManager'
import ConfirmDialog from '../features/money/ConfirmDialog'
import { getCategoryIcon } from '../features/money/moneyIcons'
import {
  allCategories, entriesForMonth, expenseBreakdown, formatMonthLabel, groupByDay,
  localISODate, monthKeyOf, monthTotals, resolveCategory, shiftMonth,
} from '../features/money/moneyUtils'
import type { MoneyEntry } from '../features/money/moneyTypes'
import EmptyState from '../components/EmptyState'
import CurrencyAmount from '../components/CurrencyAmount'
import { formatDate } from '../utils/dateUtils'
import { BRAND_GRADIENT } from '../constants/styles'

type Filter = 'all' | 'income' | 'expense'

export default function MoneyPage() {
  const { entries, customCategories, addEntry, updateEntry, deleteEntry } = useMoneyStore()
  const categories = useMemo(() => allCategories(customCategories), [customCategories])

  const [month, setMonth] = useState(() => monthKeyOf(localISODate()))
  const [filter, setFilter] = useState<Filter>('all')
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<MoneyEntry | null>(null)
  const [showCategories, setShowCategories] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<MoneyEntry | null>(null)

  const monthEntries = useMemo(() => entriesForMonth(entries, month), [entries, month])
  const totals = useMemo(() => monthTotals(monthEntries), [monthEntries])
  const breakdown = useMemo(() => expenseBreakdown(monthEntries), [monthEntries])
  const groups = useMemo(
    () => groupByDay(filter === 'all' ? monthEntries : monthEntries.filter((e) => e.type === filter)),
    [monthEntries, filter],
  )

  // Entries whose category was deleted elsewhere fold into "Other" in the
  // breakdown too, not only in the list rows.
  const breakdownRows = useMemo(() => {
    const merged = new Map<string, { categoryId: string; total: number }>()
    for (const row of breakdown) {
      const id = resolveCategory(categories, { type: 'expense', categoryId: row.categoryId }).id
      const prev = merged.get(id)
      merged.set(id, { categoryId: id, total: (prev?.total ?? 0) + row.total })
    }
    const grand = [...merged.values()].reduce((s, r) => s + r.total, 0)
    return [...merged.values()]
      .sort((a, b) => b.total - a.total)
      .map((r) => ({ ...r, share: grand > 0 ? r.total / grand : 0 }))
  }, [breakdown, categories])

  const hasAnyEntries = entries.length > 0

  return (
    <div className="min-h-screen bg-page transition-colors duration-300">
      <div style={{ background: BRAND_GRADIENT }}>
        <div className="max-w-2xl mx-auto px-4 pt-5 pb-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-[22px] font-bold text-white tracking-tight leading-tight">Money</h1>
              <p className="text-[12px] text-white/55 font-medium">Where your money goes</p>
            </div>
            <button
              onClick={() => setShowCategories(true)}
              aria-label="Manage categories"
              className="w-9 h-9 rounded-xl bg-white/[0.13] border border-white/[0.12] flex items-center justify-center hover:opacity-80 transition-opacity"
            >
              <Tags className="w-4 h-4 text-white" />
            </button>
          </div>

          <div className="rounded-2xl p-4 bg-white/[0.13] backdrop-blur-sm border border-white/[0.12]">
            <div className="flex items-center justify-between mb-2">
              <button onClick={() => setMonth(shiftMonth(month, -1))} aria-label="Previous month" className="w-8 h-8 flex items-center justify-center hover:opacity-70">
                <ChevronLeft className="w-4 h-4 text-white" />
              </button>
              <span className="text-[12px] font-semibold text-white/70 uppercase tracking-wider">{formatMonthLabel(month)}</span>
              <button onClick={() => setMonth(shiftMonth(month, 1))} aria-label="Next month" className="w-8 h-8 flex items-center justify-center hover:opacity-70">
                <ChevronRight className="w-4 h-4 text-white" />
              </button>
            </div>
            <p className="text-center text-[11px] font-semibold text-white/60 uppercase tracking-wider">Net this month</p>
            <p className="text-center text-[28px] font-bold font-mono text-white tracking-tight">
              {totals.net < 0 && '−'}
              <CurrencyAmount value={Math.abs(totals.net)} />
            </p>
            <div className="flex justify-center gap-4 mt-1 text-[12px] font-medium">
              <span className="text-white/80">
                <span style={{ color: '#3ECF8E' }}><CurrencyAmount value={totals.income} /></span> income
              </span>
              <span className="text-white/80">
                <span className="text-red-300"><CurrencyAmount value={totals.expenses} /></span> spent
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-3 pt-3 pb-28 space-y-3">
        {!hasAnyEntries ? (
          <EmptyState icon={Wallet} title="No entries yet" subtitle="Add your first income or expense to see where your money goes.">
            <button
              onClick={() => setShowForm(true)}
              className="px-5 py-2.5 rounded-xl bg-brand text-on-brand font-semibold text-[14px] hover:opacity-90"
            >
              Add your first entry
            </button>
          </EmptyState>
        ) : (
          <>
            <section className="bg-card rounded-2xl border border-themed p-4">
              <h2 className="text-[11px] font-semibold text-muted uppercase tracking-wider mb-3">Where it went</h2>
              {breakdownRows.length === 0 ? (
                <p className="text-[13px] text-secondary">No expenses this month</p>
              ) : (
                <ul className="space-y-3">
                  {breakdownRows.map((row) => {
                    const cat = resolveCategory(categories, { type: 'expense', categoryId: row.categoryId })
                    const Icon = getCategoryIcon(cat.icon)
                    return (
                      <li key={row.categoryId}>
                        <div className="flex items-center gap-2 mb-1">
                          <Icon className="w-3.5 h-3.5 text-muted shrink-0" />
                          <span className="text-[13px] font-semibold text-primary flex-1 truncate">{cat.name}</span>
                          <span className="text-[13px] font-mono text-primary"><CurrencyAmount value={row.total} /></span>
                          <span className="text-[11px] text-muted w-9 text-right">{Math.round(row.share * 100)}%</span>
                        </div>
                        <div className="h-1.5 bg-subtle rounded-full overflow-hidden">
                          <div className="h-full bg-brand rounded-full" style={{ width: `${Math.max(row.share * 100, 2)}%` }} />
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </section>

            <div className="flex gap-1.5">
              {(['all', 'income', 'expense'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  aria-pressed={filter === f}
                  className={`text-[12px] font-semibold px-3 py-1.5 rounded-full transition-all ${
                    filter === f ? 'bg-brand text-on-brand' : 'bg-subtle text-secondary hover:opacity-80'
                  }`}
                >
                  {f === 'all' ? 'All' : f === 'income' ? 'Income' : 'Expenses'}
                </button>
              ))}
            </div>

            {groups.length === 0 ? (
              <p className="text-[13px] text-secondary text-center py-8">Nothing here for {formatMonthLabel(month)}.</p>
            ) : (
              groups.map((g) => (
                <section key={g.date}>
                  <h3 className="text-[11px] font-semibold text-muted uppercase tracking-wider mb-1.5 px-1">
                    {formatDate(`${g.date}T00:00:00`, { weekday: 'short', day: 'numeric', month: 'short' })}
                  </h3>
                  <ul className="space-y-1.5">
                    {g.entries.map((e) => {
                      const cat = resolveCategory(categories, e)
                      const Icon = getCategoryIcon(cat.icon)
                      return (
                        <li key={e.id}>
                          <button
                            onClick={() => setEditing(e)}
                            className="w-full flex items-center gap-3 bg-card rounded-2xl border border-themed px-3 py-2.5 text-left active:scale-[0.99] transition-all hover:bg-card-hover"
                          >
                            <div className="w-9 h-9 rounded-[11px] bg-brand/10 flex items-center justify-center shrink-0">
                              <Icon className="w-4 h-4 text-brand" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-[14px] font-semibold text-primary tracking-tight truncate">{cat.name}</p>
                              {e.note && <p className="text-[12px] text-muted truncate">{e.note}</p>}
                            </div>
                            <span
                              className={`text-[14px] font-mono font-semibold shrink-0 ${
                                e.type === 'income' ? 'text-emerald-500 dark:text-emerald-400' : 'text-primary'
                              }`}
                            >
                              {e.type === 'income' ? '+' : '−'}
                              <CurrencyAmount value={e.amount} />
                            </span>
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                </section>
              ))
            )}
          </>
        )}
      </div>

      <button
        onClick={() => setShowForm(true)}
        aria-label="Add entry"
        className="fixed right-4 bottom-24 w-14 h-14 rounded-full bg-brand text-on-brand shadow-lg flex items-center justify-center active:scale-95 transition-all z-20"
      >
        <Plus className="w-6 h-6" />
      </button>

      {showForm && (
        <MoneyEntryForm
          onClose={() => setShowForm(false)}
          onSubmit={(data) => {
            addEntry(data)
            // Jump to the month the entry landed in, or it appears to vanish.
            setMonth(monthKeyOf(data.date))
            setShowForm(false)
          }}
        />
      )}

      {editing && (
        <MoneyEntryForm
          initial={editing}
          onClose={() => setEditing(null)}
          onSubmit={(data) => {
            updateEntry(editing.id, data)
            setMonth(monthKeyOf(data.date))
            setEditing(null)
          }}
          onDelete={() => setPendingDelete(editing)}
        />
      )}

      {showCategories && <CategoryManager onClose={() => setShowCategories(false)} />}

      {pendingDelete && (
        <ConfirmDialog
          title="Delete Entry"
          message="Delete this entry? This cannot be undone."
          confirmLabel="Delete"
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => {
            deleteEntry(pendingDelete.id)
            setPendingDelete(null)
            setEditing(null)
          }}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 2: Add the route**

In `src/App.tsx`, add `import MoneyPage from './pages/MoneyPage'` beside the other page imports, and add this line after the `/savings/:id` route:

```tsx
        <Route path="/money" element={<MoneyPage />} />
```

Then check BottomNav's "sub-pages keep their parent tab lit" mapping (`src/components/BottomNav.tsx`, the comment near line 12): add `/money` to More's children the same way `/bills` and `/savings` are listed.

- [ ] **Step 3: Add the More row**

In `src/pages/MorePage.tsx`, change the lucide import to `import { Receipt, PiggyBank, Wallet, Settings, ChevronRight } from 'lucide-react'` and add this item to `MORE_ITEMS`, between Savings and Settings:

```ts
  { path: '/money', icon: Wallet, label: 'Money', description: 'Track income and expenses' },
```

- [ ] **Step 4: Add the changelog entry**

In `src/features/whatsNew/changelog.ts`, insert as the first element of `CHANGELOG`:

```ts
  {
    version: '1.6.0',
    date: '2026-10-02',
    title: 'Money Tracker',
    highlights: [
      'A new Money page under More lets you log income and expenses so you can see where your money goes.',
      'Each month shows your net, what you earned and spent, and a breakdown of spending by category.',
      'Add your own categories on top of the built-in ones. Deleting one moves its entries to Other.',
      'Money entries are included in backups. They are separate from your loans, bills and health score.',
    ],
  },
```

- [ ] **Step 5: Type-check, test, build**

Run: `npx tsc --noEmit -p tsconfig.app.json && npm test && npm run build`
Expected: no type errors, all tests PASS, build succeeds.

- [ ] **Step 6: Verify in the running app**

Run `npm run dev`, open the app and check each of these (use the `run` skill or the browser tools):
1. More → Money opens the page; the bottom nav keeps More lit.
2. Empty state shows "Add your first entry"; adding an expense (₱250, Food, today) shows it in the list, the net as `−₱250.00`, and a Food row at 100% in "Where it went".
3. Adding income (₱1,000, Salary) turns the net positive; the Income filter shows only it.
4. In the form, "+ New" → name "Pets" + an icon → the category is selected and usable. Creating "pets" again shows "That category already exists".
5. Categories (tag icon) → rename Pets to "Pet care"; delete it → entries move to Other, and the list rows show "Other".
6. Month arrows move between months; an entry dated in another month appears only there, and saving it jumps to its month.
7. Settings → export, delete an entry, import the file back: the entry returns. Importing an old backup (a file containing only `loans`) leaves money entries untouched.
8. Dark and light themes both render the page correctly; the page works at phone width.

- [ ] **Step 7: Commit**

```bash
git add src/pages/MoneyPage.tsx src/App.tsx src/pages/MorePage.tsx src/components/BottomNav.tsx src/features/whatsNew/changelog.ts
git commit -m "Add the Money page for tracking income and expenses

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

## Self-Review Notes

- **Spec coverage:** data/types/categories/delete rule/keys → Tasks 1–2; backup (optional keys, counts, leave-untouched) → Tasks 1–2; route + More row → Task 5; page layout (header month nav + net, breakdown, filter chips, grouped list), add/edit sheet with type toggle/amount/category chips/inline new/date/note/delete, manage categories with confirm "Entries will move to Other" → Tasks 4–5; edge cases (amount > 0, future dates, empty states, name rules) → Tasks 1, 4, 5; tests → Task 1; manual UI check → Task 5 Step 6. Global bottom-nav Add button untouched.
- **Deliberate deviation from the spec text:** the spec says categories are "seeded on first load"; the plan instead keeps built-ins in code and persists only custom ones. Same behaviour, but built-ins can never be lost or duplicated by a bad backup.
- **Type consistency:** `addCategory` returns `string | null` and `renameCategory` returns `boolean` everywhere they're used; `MoneyEntryFormData` is the one shape passed through `onSubmit`/`addEntry`/`updateEntry`; `BackupCounts.moneyEntries` is added in Task 2 and consumed in the same task's Settings edit.
