import { describe, it, expect } from 'vitest'
import type { Loan } from './loanTypes'
import { isTracked, debtFreeDate, getOverdueLoans, upcomingPayments, isOverdue, paymentSchedule, nextDueDate, endDate, monthlyLoanPayments } from './loanUtils'

const NOW = new Date()

function isoOffset(days: number): string {
  const d = new Date(NOW)
  d.setDate(d.getDate() + days)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function makeLoan(overrides: Partial<Loan> = {}): Loan {
  return {
    id: 'loan-1', name: 'Phone', color: '#F3622D', totalAmount: 12000, monthlyPayment: 1000,
    interestRate: 0, durationMonths: 12, startDate: isoOffset(20), monthsPaid: 0, totalPaid: 0,
    totalInterestPaid: 0, createdAt: '2026-01-01T00:00:00.000Z', ...overrides,
  }
}

describe('isTracked', () => {
  it('leaves out private and archived loans', () => {
    expect(isTracked(makeLoan({ private: true }))).toBe(false)
    expect(isTracked(makeLoan({ archived: true }))).toBe(false)
    expect(isTracked(makeLoan())).toBe(true)
  })
})

describe('private loans in aggregates', () => {
  it('do not push out the debt-free date', () => {
    const pub = makeLoan({ id: 'pub', durationMonths: 6 })
    const secret = makeLoan({ id: 'secret', durationMonths: 24, private: true })
    expect(debtFreeDate([pub, secret])).toEqual(debtFreeDate([pub]))
  })

  it('are never reported as overdue or upcoming', () => {
    const overdue = makeLoan({ startDate: isoOffset(-5), private: true })
    expect(getOverdueLoans([overdue])).toEqual([])
    expect(upcomingPayments([makeLoan({ startDate: isoOffset(1), private: true })])).toBeNull()
  })

  it('still show as overdue on their own, inside the folder', () => {
    expect(isOverdue(makeLoan({ startDate: isoOffset(-5), private: true }))).toBe(true)
  })
})

describe('month-end start dates', () => {
  // A loan starting on the 31st must be due on the last day of shorter
  // months, not spill into the next month (Jan 31 + 1 month used to be Mar 3).
  const monthEnd = () => makeLoan({ startDate: '2026-01-31', durationMonths: 4, monthsPaid: 0 })
  const local = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

  it('schedules each payment in its own month', () => {
    expect(paymentSchedule(monthEnd()).map((p) => local(p.date)))
      .toEqual(['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30'])
  })

  it('gives the next due date in the right month', () => {
    expect(local(nextDueDate({ ...monthEnd(), monthsPaid: 1 })!)).toBe('2026-02-28')
  })

  it('ends the loan in the right month', () => {
    expect(endDate(makeLoan({ startDate: '2026-01-31', durationMonths: 1 }))).toBe('2026-02-28')
  })
})

describe('monthlyLoanPayments', () => {
  it('adds up what each active loan bills, skipping paid, archived and private loans', () => {
    const loans = [
      makeLoan({ id: 'a', monthlyPayment: 1000 }),
      makeLoan({ id: 'b', monthlyPayment: 2500.5 }),
      makeLoan({ id: 'paid', monthlyPayment: 900, monthsPaid: 12 }),
      makeLoan({ id: 'arch', monthlyPayment: 800, archived: true }),
      makeLoan({ id: 'priv', monthlyPayment: 700, private: true }),
    ]
    expect(monthlyLoanPayments(loans)).toBe(3500.5)
  })

  it('uses the billed figure even when it is off schedule', () => {
    // ₱12,000 at 2%/month over 12 months schedules ₱1,240, but the lender bills ₱1,300.
    const offSchedule = makeLoan({ totalAmount: 12000, interestRate: 2, monthlyPayment: 1300 })
    expect(monthlyLoanPayments([offSchedule])).toBe(1300)
  })
})
