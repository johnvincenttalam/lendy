import { create } from 'zustand'
import { STORAGE_FIELDS } from '../backup/schema'

const INCOME_KEY = STORAGE_FIELDS.monthlyIncome

const loadIncome = () => Number(localStorage.getItem(INCOME_KEY)) || 0

type IncomeStore = {
  monthlyIncome: number
  setMonthlyIncome: (income: number) => void
  /** Re-reads the income after a restore wrote it to the device. */
  reloadFromStorage: () => void
}

export const useIncomeStore = create<IncomeStore>((set) => ({
  monthlyIncome: loadIncome(),

  setMonthlyIncome: (income) => {
    localStorage.setItem(INCOME_KEY, String(income))
    set({ monthlyIncome: income })
  },

  reloadFromStorage: () => set({ monthlyIncome: loadIncome() }),
}))
