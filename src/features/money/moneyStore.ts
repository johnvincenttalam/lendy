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
