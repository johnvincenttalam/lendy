import { describe, it, expect } from 'vitest'
import type { Loan } from '../loans/loanTypes'
import type { Bill } from '../bills/billTypes'
import { cashLoanMonthly, checkNewLoan, currentMonthlyPayments, lastPaymentDate, paymentSteps, projectedFinish } from './plannerUtils'

const NOW = new Date(2026, 10, 25, 10)

function loan(name: string, monthly: number, months: number, startDate: string, paid: number, extra: Partial<Loan> = {}): Loan {
  return {
    id: name, name, color: '#000', totalAmount: monthly * months, monthlyPayment: monthly, interestRate: 0,
    durationMonths: months, startDate, monthsPaid: paid, totalPaid: monthly * paid, totalInterestPaid: 0,
    createdAt: '2026-01-01T00:00:00.000Z', ...extra,
  }
}

const bill = (amount: number, archived = false): Bill => ({
  id: String(amount), name: 'Bill', color: '#000', category: 'Rent', amount, nextDueDate: '2026-12-01',
  createdAt: '2026-01-01T00:00:00.000Z', archived,
})

// ₱9,251.25 a month against a ₱8,000 limit (₱20,000 income).
const stretched = [
  loan('Home Credit TV', 2_480, 12, '2026-06-10', 5),
  loan('Gloan Techno', 3_900, 6, '2026-07-15', 5),
  loan('Sloan', 2_871.25, 3, '2026-10-01', 2),
  loan('Secret', 5_000, 10, '2026-08-01', 4, { private: true }),
  loan('Old', 1_000, 6, '2026-01-01', 2, { archived: true }),
  loan('Done', 1_000, 6, '2026-01-01', 6),
]

describe('payments ahead', () => {
  it('counts only regular loans still being paid', () => {
    expect(currentMonthlyPayments(stretched)).toBe(9_251.25)
  })

  it('steps monthly payments down as each loan finishes', () => {
    expect(paymentSteps(stretched, NOW)).toEqual([
      { from: '2027-01-01', lastPayment: '2026-12-01', estimated: false, loans: ['Sloan'], freed: 2_871.25, monthlyAfter: 6_380 },
      { from: '2027-01-15', lastPayment: '2026-12-15', estimated: false, loans: ['Gloan Techno'], freed: 3_900, monthlyAfter: 2_480 },
      // Behind since 2026-11-10: 7 payments left, caught up from today (Nov 25).
      { from: '2027-06-25', lastPayment: '2027-05-25', estimated: true, loans: ['Home Credit TV'], freed: 2_480, monthlyAfter: 0 },
    ])
  })

  it('groups loans that finish together', () => {
    const steps = paymentSteps([loan('A', 1_000, 3, '2026-12-01', 0), loan('B', 500, 3, '2026-12-01', 0)], NOW)
    expect(steps).toEqual([{ from: '2027-03-01', lastPayment: '2027-02-01', estimated: false, loans: ['A', 'B'], freed: 1_500, monthlyAfter: 0 }])
  })

  it('puts the last payment one month before the loan ends', () => {
    expect(lastPaymentDate(loan('A', 1, 12, '2026-04-20', 0))).toBe('2027-03-20')
  })

  it('never puts a finish in the past for a loan whose whole schedule has slipped by', () => {
    // Every payment was due by 2026-10-01, but two are still unpaid.
    const late = projectedFinish(loan('Late', 1_000, 3, '2026-08-01', 1), NOW)
    expect(late).toEqual({ lastPayment: '2026-12-25', from: '2027-01-25', estimated: true })
  })

  it('keeps month-end days inside short months', () => {
    const late = projectedFinish(loan('Late', 1_000, 4, '2026-10-01', 0), new Date(2027, 0, 31))
    expect(late.lastPayment).toBe('2027-04-30')
  })
})

describe('trying a new loan', () => {
  it('works out a flat-interest cash loan', () => {
    // ₱20,000 at 3%/month for 12 months: ₱7,200 interest, ₱27,200 in all.
    expect(cashLoanMonthly(20_000, 3, 12)).toBe(2_266.67)
    const check = checkNewLoan([], [], 50_000, { monthly: 2_266.67, months: 12, amount: 20_000, monthlyRate: 3 }, NOW)
    expect(check.totalCost).toBe(27_200)
    expect(check.totalInterest).toBe(7_200)
  })

  it('without the amount, totals the monthly payments and leaves interest unknown', () => {
    const check = checkNewLoan([], [], 50_000, { monthly: 1_500, months: 6 }, NOW)
    expect(check.totalCost).toBe(9_000)
    expect(check.totalInterest).toBeNull()
  })

  it('is comfortable with plenty of room, and counts active bills in what is left', () => {
    const roomy = [loan('Phone', 2_500, 12, '2026-04-20', 8), loan('Motorcycle', 3_500, 24, '2026-02-05', 10)]
    const check = checkNewLoan(roomy, [bill(8_000), bill(549), bill(999, true)], 50_000, { monthly: 3_000, months: 12 }, NOW)
    expect(check).toMatchObject({
      verdict: 'comfortable', currentMonthly: 6_000, newMonthly: 9_000, limit: 20_000, roomAfter: 11_000,
      shareBefore: 12, shareAfter: 18, billsMonthly: 8_549, leftAfterAll: 32_451, fitsFrom: null, neverFits: false,
    })
  })

  it('is tight when it fits but takes more than 35% of income', () => {
    expect(checkNewLoan([loan('A', 6_000, 12, '2026-10-01', 1)], [], 20_000, { monthly: 1_500, months: 6 }, NOW).verdict).toBe('tight')
  })

  it('is over the limit, and says when it would fit', () => {
    const check = checkNewLoan(stretched, [], 20_000, { monthly: 1_500, months: 6 }, NOW)
    expect(check).toMatchObject({ verdict: 'over', newMonthly: 10_751.25, roomAfter: -2_751.25, neverFits: false })
    // After Sloan finishes: ₱6,380 + ₱1,500 = ₱7,880, under ₱8,000.
    expect(check.fitsFrom?.loans).toEqual(['Sloan'])
  })

  it('never fits when the new payment alone is over the limit', () => {
    const check = checkNewLoan(stretched, [], 20_000, { monthly: 9_000, months: 6 }, NOW)
    expect(check).toMatchObject({ verdict: 'over', fitsFrom: null, neverFits: true })
  })

  it('has no verdict without an income', () => {
    expect(checkNewLoan(stretched, [], 0, { monthly: 1_500, months: 6 }, NOW)).toMatchObject({
      verdict: 'no-income', limit: null, roomAfter: null, leftAfterAll: null,
    })
  })
})
