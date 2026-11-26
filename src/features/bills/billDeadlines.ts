import type { DeadlineCollector } from '../../core/deadlines/deadlines'
import { statusFor } from '../../core/deadlines/deadlines'
import { calendarDaysBetween, parseLocalISODate } from '../../core/time/localDate'
import { remainingForCycle } from './billUtils'

/** Each active bill's current cycle, for whatever is still owed on it. */
export const billDeadlines: DeadlineCollector = ({ bills, billPayments }, now) =>
  bills.flatMap((bill) => {
    if (bill.archived) return []
    const amount = remainingForCycle(bill, billPayments)
    if (amount <= 0) return []
    const dueDate = bill.nextDueDate.slice(0, 10)
    const daysUntil = calendarDaysBetween(now, parseLocalISODate(dueDate))
    return [{
      id: `bills:${bill.id}:${dueDate}`,
      module: 'bills' as const,
      recordId: bill.id,
      title: bill.name,
      color: bill.color,
      amount,
      installments: 1,
      daysUntil,
      dueDate,
      status: statusFor(daysUntil),
      href: `/bills/${bill.id}`,
    }]
  })
