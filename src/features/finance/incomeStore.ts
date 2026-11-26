import { create } from 'zustand'
import { persist } from '../storage/persist'

type IncomeStore = {
  monthlyIncome: number
  setMonthlyIncome: (income: number) => void
  /** Fills the store from storage: at start-up, and after a restore or undo. */
  hydrate: (monthlyIncome: number) => void
}

export const useIncomeStore = create<IncomeStore>((set, get) => ({
  monthlyIncome: 0,

  setMonthlyIncome: (income) => {
    void persist({ monthlyIncome: { next: income, prev: get().monthlyIncome } })
    set({ monthlyIncome: income })
  },

  hydrate: (monthlyIncome) => set({ monthlyIncome }),
}))
