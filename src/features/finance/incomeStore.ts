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
