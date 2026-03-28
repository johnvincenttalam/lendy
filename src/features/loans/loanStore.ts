import { create } from 'zustand'
import type { Loan, LoanFormData } from './loanTypes'
import { monthlyInterestPortion } from './loanUtils'
import { showToast } from '../../components/Toast'
import { triggerConfetti } from '../../components/Confetti'

const STORAGE_KEY = 'loan-tracker-loans'
const INCOME_KEY = 'loan-tracker-income'
const SORT_KEY = 'loan-tracker-sort'

export type SortOption = 'newest' | 'oldest' | 'balance-high' | 'balance-low' | 'progress' | 'payment'

function loadLoans(): Loan[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY)
    if (!data) return []
    const loans: Loan[] = JSON.parse(data)
    return loans.map((loan) => ({
      ...loan,
      color: loan.color || '#F3622D',
      interestRate: loan.interestRate ?? 0,
      totalInterestPaid: loan.totalInterestPaid ?? 0,
    }))
  } catch {
    return []
  }
}

function saveLoans(loans: Loan[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(loans))
}

type LoanStore = {
  loans: Loan[]
  monthlyIncome: number
  sortBy: SortOption
  addLoan: (data: LoanFormData) => void
  updateLoan: (id: string, data: Partial<Loan>) => void
  markAsPaid: (id: string) => void
  undoMarkAsPaid: (id: string) => void
  deleteLoan: (id: string) => void
  setMonthlyIncome: (income: number) => void
  setSortBy: (sort: SortOption) => void
  exportCSV: () => string
  exportBackup: () => string
  importBackup: (json: string) => boolean
}

export const useLoanStore = create<LoanStore>((set, get) => ({
  loans: loadLoans(),
  monthlyIncome: Number(localStorage.getItem(INCOME_KEY)) || 0,
  sortBy: (localStorage.getItem(SORT_KEY) as SortOption) || 'newest',

  addLoan: (data) =>
    set((state) => {
      const newLoan: Loan = {
        ...data,
        id: crypto.randomUUID(),
        monthsPaid: 0,
        totalPaid: 0,
        totalInterestPaid: 0,
        createdAt: new Date().toISOString(),
      }
      const loans = [...state.loans, newLoan]
      saveLoans(loans)
      showToast(`"${data.name}" added`)
      return { loans }
    }),

  updateLoan: (id, data) =>
    set((state) => {
      const loans = state.loans.map((loan) =>
        loan.id === id ? { ...loan, ...data } : loan
      )
      saveLoans(loans)
      return { loans }
    }),

  markAsPaid: (id) =>
    set((state) => {
      const loans = state.loans.map((loan) => {
        if (loan.id !== id) return loan
        if (loan.monthsPaid >= loan.durationMonths) return loan

        const interestPortion = monthlyInterestPortion(loan)
        const newMonthsPaid = loan.monthsPaid + 1
        const fullyPaid = newMonthsPaid >= loan.durationMonths

        setTimeout(() => {
          if (fullyPaid) {
            triggerConfetti()
            showToast(`"${loan.name}" is fully paid!`)
          } else {
            showToast(
              `Payment ${newMonthsPaid}/${loan.durationMonths} marked`,
              {
                label: 'UNDO',
                onClick: () => get().undoMarkAsPaid(id),
              }
            )
          }
        }, 0)

        return {
          ...loan,
          monthsPaid: newMonthsPaid,
          totalPaid: loan.totalPaid + loan.monthlyPayment,
          totalInterestPaid: loan.totalInterestPaid + interestPortion,
        }
      })
      saveLoans(loans)
      return { loans }
    }),

  undoMarkAsPaid: (id) =>
    set((state) => {
      const loans = state.loans.map((loan) => {
        if (loan.id !== id) return loan
        if (loan.monthsPaid <= 0) return loan

        const interestPortion = monthlyInterestPortion(loan)

        return {
          ...loan,
          monthsPaid: loan.monthsPaid - 1,
          totalPaid: loan.totalPaid - loan.monthlyPayment,
          totalInterestPaid: loan.totalInterestPaid - interestPortion,
        }
      })
      saveLoans(loans)
      showToast('Payment undone')
      return { loans }
    }),

  deleteLoan: (id) =>
    set((state) => {
      const loan = state.loans.find((l) => l.id === id)
      const loans = state.loans.filter((l) => l.id !== id)
      saveLoans(loans)
      if (loan) showToast(`"${loan.name}" deleted`)
      return { loans }
    }),

  setMonthlyIncome: (income) => {
    localStorage.setItem(INCOME_KEY, String(income))
    set({ monthlyIncome: income })
  },

  setSortBy: (sort) => {
    localStorage.setItem(SORT_KEY, sort)
    set({ sortBy: sort })
  },

  exportCSV: () => {
    const { loans } = get()
    const headers = ['Name', 'Total Amount', 'Monthly Payment', 'Interest Rate (%/mo)', 'Duration (months)', 'Months Paid', 'Total Paid', 'Start Date', 'Status']
    const rows = loans.map((l) => [
      `"${l.name}"`,
      l.totalAmount.toFixed(2),
      l.monthlyPayment.toFixed(2),
      l.interestRate.toString(),
      l.durationMonths.toString(),
      l.monthsPaid.toString(),
      l.totalPaid.toFixed(2),
      l.startDate,
      l.monthsPaid >= l.durationMonths ? 'Paid' : 'Active',
    ])
    return [headers, ...rows].map((r) => r.join(',')).join('\n')
  },

  exportBackup: () => {
    const { loans, monthlyIncome } = get()
    return JSON.stringify({ loans, monthlyIncome, exportedAt: new Date().toISOString() }, null, 2)
  },

  importBackup: (json) => {
    try {
      const data = JSON.parse(json)
      if (!Array.isArray(data.loans)) return false
      const loans = data.loans.map((loan: Loan) => ({
        ...loan,
        color: loan.color || '#F3622D',
        interestRate: loan.interestRate ?? 0,
        totalInterestPaid: loan.totalInterestPaid ?? 0,
      }))
      saveLoans(loans)
      if (data.monthlyIncome) {
        localStorage.setItem(INCOME_KEY, String(data.monthlyIncome))
        set({ loans, monthlyIncome: data.monthlyIncome })
      } else {
        set({ loans })
      }
      showToast(`${loans.length} loans restored`)
      return true
    } catch {
      showToast('Invalid backup file')
      return false
    }
  },
}))
