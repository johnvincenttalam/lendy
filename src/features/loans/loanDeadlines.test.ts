import { describe, it, expect } from 'vitest'
import { loanDeadlines } from './loanDeadlines'
import type { Loan } from './loanTypes'

// 00:30 local: just after midnight, where a UTC slip would show.
const NOW = new Date(2026, 10, 26, 0, 30)

function loan(over: Partial<Loan> = {}): Loan {
  return {
    id: 'L1', name: 'Phone', color: '#3B82F6', totalAmount: 6000, monthlyPayment: 1000, interestRate: 0,
    durationMonths: 6, startDate: '2026-11-26', monthsPaid: 0, totalPaid: 0, totalInterestPaid: 0,
    createdAt: '2026-11-01T00:00:00.000Z', ...over,
  }
}
const run = (loans: Loan[]) => loanDeadlines({ loans, bills: [], billPayments: [] }, NOW)

describe('loanDeadlines', () => {
  it('lists a payment due today as today, not overdue', () => {
    expect(run([loan()])).toEqual([{
      id: 'loans:L1:2026-11-26', module: 'loans', recordId: 'L1', title: 'Phone', color: '#3B82F6',
      amount: 1000, installments: 1, daysUntil: 0, dueDate: '2026-11-26', status: 'today', href: '/loan/L1',
    }])
  })

  it('sums every missed instalment when a loan is behind', () => {
    const [d] = run([loan({ startDate: '2026-09-26' })])
    // Sep 26 and Oct 26 are missed; Nov 26 is due today, which isn't overdue yet.
    expect(d).toMatchObject({ status: 'overdue', installments: 2, amount: 2000, dueDate: '2026-09-26' })
    expect(d.daysUntil).toBeLessThan(0)
  })

  it('leaves out private, archived and paid-off loans', () => {
    expect(run([
      loan({ id: 'p', private: true }),
      loan({ id: 'a', archived: true }),
      loan({ id: 'f', monthsPaid: 6, totalPaid: 6000 }),
    ])).toEqual([])
  })
})
