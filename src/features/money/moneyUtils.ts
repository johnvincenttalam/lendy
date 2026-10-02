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
