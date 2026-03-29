import { useEffect } from 'react'
import { useLoanStore } from '../loans/loanStore'
import { useNotificationStore } from './notificationStore'
import { isFullyPaid, formatCurrency } from '../loans/loanUtils'
import type { Loan } from '../loans/loanTypes'

function getNextDueDate(loan: Loan): Date {
  const d = new Date(loan.startDate)
  d.setMonth(d.getMonth() + loan.monthsPaid)
  return d
}

function getUpcomingPayments(loans: Loan[], reminderDays: number) {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  return loans
    .filter((l) => !isFullyPaid(l))
    .map((loan) => {
      const dueDate = getNextDueDate(loan)
      const due = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate())
      const diff = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
      return { loan, dueDate: due, daysUntil: diff }
    })
    .filter(({ daysUntil }) => daysUntil >= 0 && daysUntil <= reminderDays)
}

export function useNotificationCheck() {
  const loans = useLoanStore((s) => s.loans)
  const { enabled, reminderDays, lastChecked, markChecked } = useNotificationStore()

  useEffect(() => {
    if (!enabled) return
    if (!('Notification' in window)) return

    const today = new Date().toISOString().split('T')[0]
    if (lastChecked === today) return

    if (Notification.permission !== 'granted') return

    const upcoming = getUpcomingPayments(loans, reminderDays)
    for (const { loan, daysUntil } of upcoming) {
      const when = daysUntil === 0 ? 'today' : daysUntil === 1 ? 'tomorrow' : `in ${daysUntil} days`
      new Notification(`Payment due ${when}: ${loan.name}`, {
        body: `${formatCurrency(loan.monthlyPayment)} due ${when}`,
        icon: '/lendy/icon-192.png',
      })
    }

    markChecked()
  }, [enabled, loans, reminderDays, lastChecked, markChecked])
}
