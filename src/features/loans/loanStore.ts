import { create } from 'zustand'
import { DEFAULT_COLOR } from './loanTypes'
import type { Loan, LoanFormData, PaymentRecord } from './loanTypes'
import { monthlyInterestPortion, monthlyPrincipalPortion, offScheduleAmount, paymentSchedule } from './loanUtils'
import { backfillPayments } from './paymentBackfill'
import { showToast } from '../../components/toastEvents'
import { triggerConfetti } from '../../components/confettiEvents'
import { STORAGE_FIELDS } from '../backup/schema'
import { addMonthsClamped } from '../../core/time/months'

const STORAGE_KEY = STORAGE_FIELDS.loans
const PAYMENTS_KEY = STORAGE_FIELDS.payments
const SORT_KEY = 'loan-tracker-sort'
const VIEW_KEY = 'loan-tracker-view'

export type SortOption = 'newest' | 'oldest' | 'balance-high' | 'balance-low' | 'progress' | 'payment'
export type ViewMode = 'list' | 'grid'

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

type LoanStore = {
  loans: Loan[]
  payments: PaymentRecord[]
  sortBy: SortOption
  viewMode: ViewMode
  addLoan: (data: LoanFormData) => void
  updateLoan: (id: string, data: Partial<Loan>) => void
  markAsPaid: (id: string) => void
  recalcMonthlyPayment: (id: string) => void
  undoMarkAsPaid: (id: string) => void
  deleteLoan: (id: string) => void
  archiveLoan: (id: string) => void
  unarchiveLoan: (id: string) => void
  makePrivate: (id: string) => void
  makePublic: (id: string) => void
  getPaymentsForLoan: (loanId: string) => PaymentRecord[]
  setSortBy: (sort: SortOption) => void
  setViewMode: (mode: ViewMode) => void
  exportCSV: () => string
  /** Re-reads loans and payments after a restore wrote them to the device. */
  reloadFromStorage: () => void
}

const initialLoans = loadLoans()
const existingPayments = loadPayments()
const initialPayments = backfillPayments(initialLoans, existingPayments)
if (initialPayments.length > existingPayments.length) savePayments(initialPayments)

export const useLoanStore = create<LoanStore>((set, get) => ({
  loans: initialLoans,
  payments: initialPayments,
  sortBy: (localStorage.getItem(SORT_KEY) as SortOption) || 'newest',
  viewMode: (localStorage.getItem(VIEW_KEY) as ViewMode) || 'list',

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
      const loans = state.loans.map((loan) => {
        if (loan.id !== id) return loan
        const updated = { ...loan, ...data }

        // Recalculate derived fields if loan has payments and core params changed
        if (loan.monthsPaid > 0) {
          const coreChanged =
            updated.monthlyPayment !== loan.monthlyPayment ||
            updated.totalAmount !== loan.totalAmount ||
            updated.interestRate !== loan.interestRate ||
            updated.durationMonths !== loan.durationMonths

          if (coreChanged) {
            // Clamp monthsPaid to not exceed new duration
            updated.monthsPaid = Math.min(updated.monthsPaid, updated.durationMonths)

            // Recalculate totalPaid and totalInterestPaid from the payment schedule
            const schedule = paymentSchedule(updated)
            let recalcPaid = 0
            let recalcInterest = 0
            for (let i = 0; i < updated.monthsPaid; i++) {
              recalcPaid += schedule[i].payment
              recalcInterest += schedule[i].interest
            }
            updated.totalPaid = Math.round(recalcPaid * 100) / 100
            updated.totalInterestPaid = Math.round(recalcInterest * 100) / 100
          }
        }

        return updated
      })
      saveLoans(loans)
      return { loans }
    }),

  // Snap a hand-entered monthly back onto the loan's own amount/rate/tenure. Reuses
  // updateLoan so totalPaid and totalInterestPaid are rebuilt from the new schedule.
  recalcMonthlyPayment: (id) => {
    const loan = get().loans.find((l) => l.id === id)
    if (!loan) return
    const scheduled = offScheduleAmount(loan)
    if (scheduled === null) return
    get().updateLoan(id, { monthlyPayment: scheduled })
    showToast(`"${loan.name}" monthly recalculated`)
  },

  markAsPaid: (id) =>
    set((state) => {
      let newRecord: PaymentRecord | null = null
      const loans = state.loans.map((loan) => {
        if (loan.id !== id) return loan
        if (loan.monthsPaid >= loan.durationMonths) return loan

        const newMonthsPaid = loan.monthsPaid + 1
        const fullyPaid = newMonthsPaid >= loan.durationMonths

        // Use scheduled amount (handles last payment rounding adjustment)
        const schedule = paymentSchedule(loan)
        const scheduled = schedule[loan.monthsPaid]
        const paymentAmount = scheduled ? scheduled.payment : loan.monthlyPayment
        const interestPortion = scheduled ? scheduled.interest : Math.round(monthlyInterestPortion(loan) * 100) / 100
        const principalPortion = scheduled ? scheduled.principal : Math.round(monthlyPrincipalPortion(loan) * 100) / 100

        // Calculate scheduled due date for this payment
        const dueDate = scheduled ? scheduled.date : addMonthsClamped(new Date(loan.startDate), loan.monthsPaid)

        newRecord = {
          id: crypto.randomUUID(),
          loanId: loan.id,
          amount: Math.round(paymentAmount * 100) / 100,
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
          totalPaid: Math.round((loan.totalPaid + paymentAmount) * 100) / 100,
          totalInterestPaid: Math.round((loan.totalInterestPaid + interestPortion) * 100) / 100,
        }
      })
      const payments = newRecord ? [...state.payments, newRecord] : state.payments
      saveLoans(loans)
      savePayments(payments)
      return { loans, payments }
    }),

  undoMarkAsPaid: (id) =>
    set((state) => {
      // Find the last payment record for this loan first
      const loanPayments = state.payments.filter((p) => p.loanId === id)
      const lastPayment = loanPayments[loanPayments.length - 1]

      const loans = state.loans.map((loan) => {
        if (loan.id !== id) return loan
        if (loan.monthsPaid <= 0) return loan

        // Use recorded amounts from PaymentRecord instead of recalculating
        const paidAmount = lastPayment ? lastPayment.amount : loan.monthlyPayment
        const interestAmount = lastPayment ? lastPayment.interest : Math.round(monthlyInterestPortion(loan) * 100) / 100

        return {
          ...loan,
          monthsPaid: loan.monthsPaid - 1,
          totalPaid: Math.round((loan.totalPaid - paidAmount) * 100) / 100,
          totalInterestPaid: Math.round((loan.totalInterestPaid - interestAmount) * 100) / 100,
        }
      })
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

  archiveLoan: (id) =>
    set((state) => {
      const loans = state.loans.map((l) =>
        l.id === id ? { ...l, archived: true } : l
      )
      saveLoans(loans)
      const loan = loans.find((l) => l.id === id)
      if (loan) showToast(`"${loan.name}" archived`)
      return { loans }
    }),

  unarchiveLoan: (id) =>
    set((state) => {
      const loans = state.loans.map((l) =>
        l.id === id ? { ...l, archived: false } : l
      )
      saveLoans(loans)
      const loan = loans.find((l) => l.id === id)
      if (loan) showToast(`"${loan.name}" restored`)
      return { loans }
    }),

  // The toast never names the folder: it can show on a screen a borrower sees.
  makePrivate: (id) =>
    set((state) => {
      const loans = state.loans.map((l) => (l.id === id ? { ...l, private: true } : l))
      saveLoans(loans)
      const loan = loans.find((l) => l.id === id)
      if (loan) showToast(`"${loan.name}" moved`)
      return { loans }
    }),

  makePublic: (id) =>
    set((state) => {
      const loans = state.loans.map((l) => (l.id === id ? { ...l, private: false } : l))
      saveLoans(loans)
      const loan = loans.find((l) => l.id === id)
      if (loan) showToast(`"${loan.name}" moved`)
      return { loans }
    }),

  getPaymentsForLoan: (loanId) => {
    return get().payments
      .filter((p) => p.loanId === loanId)
      .sort((a, b) => a.month - b.month)
  },

  setSortBy: (sort) => {
    localStorage.setItem(SORT_KEY, sort)
    set({ sortBy: sort })
  },

  setViewMode: (mode) => {
    localStorage.setItem(VIEW_KEY, mode)
    set({ viewMode: mode })
  },

  exportCSV: () => {
    // A readable report — private loans stay out of it.
    const loans = get().loans.filter((l) => !l.private)
    const headers = ['Name', 'Total Amount', 'Monthly Payment', 'Interest Rate (%/mo)', 'Duration (months)', 'Months Paid', 'Total Paid', 'Start Date', 'Status', 'Notes']
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
      `"${(l.notes ?? '').replace(/"/g, '""')}"`,
    ])
    return [headers, ...rows].map((r) => r.join(',')).join('\n')
  },

  reloadFromStorage: () => set({ loans: loadLoans(), payments: loadPayments() }),
}))
