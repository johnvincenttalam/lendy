import { useEffect } from 'react'
import { useLoanStore } from '../loans/loanStore'
import { useNotificationStore } from './notificationStore'
import { isFullyPaid, formatCurrency, isOverdue, daysOverdue } from '../loans/loanUtils'
import type { Loan } from '../loans/loanTypes'

function getNextDueDate(loan: Loan): Date {
  const d = new Date(loan.startDate)
  d.setMonth(d.getMonth() + loan.monthsPaid)
  return d
}

type PaymentInfo = {
  loan: Loan
  dueDate: Date
  daysUntil: number
  isOverdue: boolean
  daysOverdue: number
}

function getPaymentStatus(loans: Loan[], reminderDays: number, includeDueDate: boolean, includeOverdue: boolean): PaymentInfo[] {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  return loans
    .filter((l) => !isFullyPaid(l) && !l.archived)
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

export function useNotificationCheck() {
  const loans = useLoanStore((s) => s.loans)
  const { enabled, reminderDays, remindOnDueDate, remindOverdue, lastChecked, markChecked } = useNotificationStore()

  useEffect(() => {
    if (!enabled) return
    if (!('Notification' in window)) return

    const today = new Date().toISOString().split('T')[0]
    if (lastChecked === today) return

    if (Notification.permission !== 'granted') return

    const payments = getPaymentStatus(loans, reminderDays, remindOnDueDate, remindOverdue)

    for (const { loan, daysUntil, isOverdue: overdue, daysOverdue: overdueDays } of payments) {
      if (overdue) {
        new Notification(`Overdue: ${loan.name}`, {
          body: `${formatCurrency(loan.monthlyPayment)} was due ${overdueDays} ${overdueDays === 1 ? 'day' : 'days'} ago`,
          icon: '/lendy/icon-192.png',
          tag: `overdue-${loan.id}`,
        })
      } else {
        const when = daysUntil === 0 ? 'today' : daysUntil === 1 ? 'tomorrow' : `in ${daysUntil} days`
        new Notification(`Payment due ${when}: ${loan.name}`, {
          body: `${formatCurrency(loan.monthlyPayment)} due ${when}`,
          icon: '/lendy/icon-192.png',
          tag: `upcoming-${loan.id}`,
        })
      }
    }

    markChecked()
  }, [enabled, loans, reminderDays, remindOnDueDate, remindOverdue, lastChecked, markChecked])
}

// Export for use in settings preview
export function getUpcomingPaymentsPreview(loans: Loan[], reminderDays: number): PaymentInfo[] {
  return getPaymentStatus(loans, reminderDays, true, true)
}
