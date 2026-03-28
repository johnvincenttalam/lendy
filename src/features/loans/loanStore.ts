import { create } from 'zustand'
import { DEFAULT_COLOR } from './loanTypes'
import type { Loan, LoanFormData, PaymentRecord } from './loanTypes'
import { monthlyInterestPortion, monthlyPrincipalPortion, paymentSchedule } from './loanUtils'
import { showToast } from '../../components/Toast'
import { triggerConfetti } from '../../components/Confetti'

const STORAGE_KEY = 'loan-tracker-loans'
const PAYMENTS_KEY = 'loan-tracker-payments'
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
      color: loan.color || DEFAULT_COLOR,
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

function loadPayments(): PaymentRecord[] {
  try {
    const data = localStorage.getItem(PAYMENTS_KEY)
    return data ? JSON.parse(data) : []
  } catch {
    return []
  }
}

function savePayments(payments: PaymentRecord[]) {
  localStorage.setItem(PAYMENTS_KEY, JSON.stringify(payments))
}

// Backfill payment records for existing loans that have monthsPaid > 0 but no records
function migrateExistingPayments(loans: Loan[], existingPayments: PaymentRecord[]): PaymentRecord[] {
  const loanIdsWithRecords = new Set(existingPayments.map((p) => p.loanId))
  const newRecords: PaymentRecord[] = []

  for (const loan of loans) {
    if (loan.monthsPaid <= 0 || loanIdsWithRecords.has(loan.id)) continue

    const schedule = paymentSchedule(loan)
    const principal = monthlyPrincipalPortion(loan)
    const interest = monthlyInterestPortion(loan)

    for (let i = 0; i < loan.monthsPaid; i++) {
      const scheduledDate = schedule[i]?.date ?? new Date(loan.startDate)
      newRecords.push({
        id: crypto.randomUUID(),
        loanId: loan.id,
        amount: loan.monthlyPayment,
        principal: Math.round(principal * 100) / 100,
        interest: Math.round(interest * 100) / 100,
        paidAt: scheduledDate.toISOString(),
        dueDate: scheduledDate.toISOString().split('T')[0],
        month: i + 1,
      })
    }
  }

  return [...existingPayments, ...newRecords]
}

type LoanStore = {
  loans: Loan[]
  payments: PaymentRecord[]
  monthlyIncome: number
  sortBy: SortOption
  addLoan: (data: LoanFormData) => void
  updateLoan: (id: string, data: Partial<Loan>) => void
  markAsPaid: (id: string) => void
  undoMarkAsPaid: (id: string) => void
  deleteLoan: (id: string) => void
  getPaymentsForLoan: (loanId: string) => PaymentRecord[]
  setMonthlyIncome: (income: number) => void
  setSortBy: (sort: SortOption) => void
  exportCSV: () => string
  exportBackup: () => string
  importBackup: (json: string) => boolean
}

const initialLoans = loadLoans()
const existingPayments = loadPayments()
const initialPayments = migrateExistingPayments(initialLoans, existingPayments)
if (initialPayments.length > existingPayments.length) savePayments(initialPayments)

export const useLoanStore = create<LoanStore>((set, get) => ({
  loans: initialLoans,
  payments: initialPayments,
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
      let newRecord: PaymentRecord | null = null
      const loans = state.loans.map((loan) => {
        if (loan.id !== id) return loan
        if (loan.monthsPaid >= loan.durationMonths) return loan

        const interestPortion = monthlyInterestPortion(loan)
        const principalPortion = monthlyPrincipalPortion(loan)
        const newMonthsPaid = loan.monthsPaid + 1
        const fullyPaid = newMonthsPaid >= loan.durationMonths

        // Calculate scheduled due date for this payment
        const dueDate = new Date(loan.startDate)
        dueDate.setMonth(dueDate.getMonth() + loan.monthsPaid)

        newRecord = {
          id: crypto.randomUUID(),
          loanId: loan.id,
          amount: loan.monthlyPayment,
          principal: Math.round(principalPortion * 100) / 100,
          interest: Math.round(interestPortion * 100) / 100,
          paidAt: new Date().toISOString(),
          dueDate: dueDate.toISOString().split('T')[0],
          month: newMonthsPaid,
        }

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
      const payments = newRecord ? [...state.payments, newRecord] : state.payments
      saveLoans(loans)
      savePayments(payments)
      return { loans, payments }
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
      // Remove the last payment record for this loan
      const loanPayments = state.payments.filter((p) => p.loanId === id)
      const lastPayment = loanPayments[loanPayments.length - 1]
      const payments = lastPayment
        ? state.payments.filter((p) => p.id !== lastPayment.id)
        : state.payments
      saveLoans(loans)
      savePayments(payments)
      showToast('Payment undone')
      return { loans, payments }
    }),

  deleteLoan: (id) =>
    set((state) => {
      const loan = state.loans.find((l) => l.id === id)
      const loans = state.loans.filter((l) => l.id !== id)
      const payments = state.payments.filter((p) => p.loanId !== id)
      saveLoans(loans)
      savePayments(payments)
      if (loan) showToast(`"${loan.name}" deleted`)
      return { loans, payments }
    }),

  getPaymentsForLoan: (loanId) => {
    return get().payments
      .filter((p) => p.loanId === loanId)
      .sort((a, b) => a.month - b.month)
  },

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
    const { loans, payments, monthlyIncome } = get()
    return JSON.stringify({ loans, payments, monthlyIncome, exportedAt: new Date().toISOString() }, null, 2)
  },

  importBackup: (json) => {
    try {
      const data = JSON.parse(json)
      if (!Array.isArray(data.loans)) return false
      const loans = data.loans.map((loan: Loan) => ({
        ...loan,
        color: loan.color || DEFAULT_COLOR,
        interestRate: loan.interestRate ?? 0,
        totalInterestPaid: loan.totalInterestPaid ?? 0,
      }))
      // Import payments if present, otherwise backfill from loan data
      const payments = Array.isArray(data.payments)
        ? data.payments
        : migrateExistingPayments(loans, [])
      saveLoans(loans)
      savePayments(payments)
      if (data.monthlyIncome) {
        localStorage.setItem(INCOME_KEY, String(data.monthlyIncome))
        set({ loans, payments, monthlyIncome: data.monthlyIncome })
      } else {
        set({ loans, payments })
      }
      showToast(`${loans.length} loans restored`)
      return true
    } catch {
      showToast('Invalid backup file')
      return false
    }
  },
}))
