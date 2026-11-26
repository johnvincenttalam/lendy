/**
 * What's due, across modules, as one list. Derived from the records every
 * time (nothing stored), so it can't drift from the data. Each module
 * supplies a collector; Home's Due soon, the Planner agenda, the reminders
 * bell and Ollie's reminders all read the merged list.
 */
import type { Loan } from '../../features/loans/loanTypes'
import type { Bill, BillPaymentRecord } from '../../features/bills/billTypes'

export type DeadlineStatus = 'overdue' | 'today' | 'upcoming'

export type Deadline = {
  /** `${module}:${recordId}:${dueDate}` — stable for keys and, later, snoozing. */
  id: string
  module: 'loans' | 'bills'
  recordId: string
  title: string
  color: string
  /** What's owed now: a loan that's behind sums its missed instalments; a bill is what's left of the cycle. */
  amount: number
  /** Instalments `amount` covers (more than 1 only for a loan that's behind). */
  installments: number
  /** Calendar days from today; negative when overdue. */
  daysUntil: number
  /** Local YYYY-MM-DD. */
  dueDate: string
  status: DeadlineStatus
  href: string
}

export type DeadlineInput = { loans: Loan[]; bills: Bill[]; billPayments: BillPaymentRecord[] }
export type DeadlineCollector = (input: DeadlineInput, now: Date) => Deadline[]

export function statusFor(daysUntil: number): DeadlineStatus {
  return daysUntil < 0 ? 'overdue' : daysUntil === 0 ? 'today' : 'upcoming'
}

/** Everything overdue plus what falls due within `horizonDays`; most pressing first. */
export function collectDeadlines(collectors: DeadlineCollector[], input: DeadlineInput, now: Date, horizonDays: number): Deadline[] {
  return collectors
    .flatMap((collect) => collect(input, now))
    .filter((d) => d.daysUntil <= horizonDays)
    .sort((a, b) => a.daysUntil - b.daysUntil || b.amount - a.amount || a.title.localeCompare(b.title))
}
