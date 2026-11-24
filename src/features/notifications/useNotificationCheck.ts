import { useEffect } from 'react'
import { useLoanStore } from '../loans/loanStore'
import { useNotificationStore } from './notificationStore'
import { formatCurrency } from '../loans/loanUtils'
import { getPaymentStatus } from './notificationUtils'
import type { PaymentInfo } from './notificationUtils'
import type { Loan } from '../loans/loanTypes'

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
          icon: `${import.meta.env.BASE_URL}icon-192.png`,
          tag: `overdue-${loan.id}`,
        })
      } else {
        const when = daysUntil === 0 ? 'today' : daysUntil === 1 ? 'tomorrow' : `in ${daysUntil} days`
        new Notification(`Payment due ${when}: ${loan.name}`, {
          body: `${formatCurrency(loan.monthlyPayment)} due ${when}`,
          icon: `${import.meta.env.BASE_URL}icon-192.png`,
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
