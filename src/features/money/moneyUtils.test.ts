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
