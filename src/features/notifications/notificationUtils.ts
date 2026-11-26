import { isFullyPaid, isOverdue, daysOverdue, isTracked, paymentSchedule } from '../loans/loanUtils'
import type { Loan } from '../loans/loanTypes'

function getNextDueDate(loan: Loan): Date {
  return paymentSchedule(loan)[loan.monthsPaid]?.date ?? new Date(loan.startDate)
}

export type PaymentInfo = {
  loan: Loan
  dueDate: Date
  daysUntil: number
  isOverdue: boolean
  daysOverdue: number
}

export function getPaymentStatus(loans: Loan[], reminderDays: number, includeDueDate: boolean, includeOverdue: boolean): PaymentInfo[] {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  return loans
    .filter((l) => !isFullyPaid(l) && isTracked(l))
    .map((loan) => {
      const dueDate = getNextDueDate(loan)
      const due = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate())
      const diff = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
      return {
        loan,
        dueDate: due,
        daysUntil: diff,
        isOverdue: isOverdue(loan),
        daysOverdue: daysOverdue(loan),
      }
    })
    .filter(({ daysUntil, isOverdue: overdue }) => {
      // Include overdue payments
      if (includeOverdue && overdue) return true
      // Include due today
      if (includeDueDate && daysUntil === 0) return true
      // Include upcoming within reminder window (but not due today unless includeDueDate)
      if (daysUntil > 0 && daysUntil <= reminderDays) return true
      return false
    })
}

