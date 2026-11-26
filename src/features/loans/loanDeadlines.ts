import type { DeadlineCollector } from '../../core/deadlines/deadlines'
import { statusFor } from '../../core/deadlines/deadlines'
import { localISODate } from '../../core/time/localDate'
import { duePaymentFor } from '../ollie/ollieUtils'

/** Each regular loan's next unpaid payment (all missed ones summed when behind). */
export const loanDeadlines: DeadlineCollector = ({ loans }, now) =>
  loans.flatMap((loan) => {
    // duePaymentFor already skips private, archived and paid-off loans.
    const due = duePaymentFor(loan, now)
    if (!due) return []
    const dueDate = localISODate(due.dueDate)
    return [{
      id: `loans:${loan.id}:${dueDate}`,
      module: 'loans' as const,
      recordId: loan.id,
      title: loan.name,
      color: loan.color,
      amount: due.amount,
      installments: due.installments,
      daysUntil: due.daysUntil,
      dueDate,
      status: statusFor(due.daysUntil),
      href: `/loan/${loan.id}`,
    }]
  })
