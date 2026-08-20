import { describe, it, expect } from 'vitest'
import { buildOverview } from './financeUtils'
import type { Loan } from '../loans/loanTypes'
import type { Bill } from '../bills/billTypes'
import type { SavingsGoal } from '../savings/savingsTypes'

function makeLoan(overrides: Partial<Loan> = {}): Loan {
  return {
    id: 'loan-1',
    name: 'Test Loan',
    color: '#F3622D',
    totalAmount: 9000,
    monthlyPayment: 1000,
    interestRate: 0,
    durationMonths: 9,
    startDate: '2026-01-01',
    monthsPaid: 0,
    totalPaid: 0,
    totalInterestPaid: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

/**
 * A 0%-interest loan whose *derived* scheduled payment is exactly `monthly`.
 *
 * buildOverview uses scheduledMonthlyPayment(), which recomputes from
 * totalAmount/interestRate/durationMonths and ignores the stored
 * monthlyPayment field entirely. Setting monthlyPayment in a fixture and
 * expecting commitments to reflect it is the trap this helper exists to avoid.
 */
function makeLoanPaying(monthly: number, overrides: Partial<Loan> = {}): Loan {
  const durationMonths = overrides.durationMonths ?? 9
  return makeLoan({
    totalAmount: monthly * durationMonths,
    interestRate: 0,
    durationMonths,
    monthlyPayment: monthly,
    ...overrides,
  })
}

function makeBill(overrides: Partial<Bill> = {}): Bill {
  return {
    id: 'bill-1',
    name: 'Electricity',
    color: '#3B82F6',
    category: 'Utilities',
    amount: 1500,
    nextDueDate: '2026-09-01',
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

function makeGoal(overrides: Partial<SavingsGoal> = {}): SavingsGoal {
  return {
    id: 'goal-1',
    name: 'Emergency Fund',
    color: '#10B981',
    targetAmount: 20000,
    currentAmount: 500,
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('buildOverview', () => {
  it('sums commitments across loans and bills', () => {
    const overview = buildOverview({
      loans: [makeLoanPaying(1105), makeLoanPaying(650, { id: 'l2' })],
      bills: [makeBill({ amount: 1500 }), makeBill({ id: 'b2', amount: 1250 })],
      goals: [],
      monthlyIncome: 20000,
    })

    expect(overview.loanCommitments).toBeCloseTo(1755, 2)
    expect(overview.billCommitments).toBe(2750)
    expect(overview.totalCommitments).toBeCloseTo(4505, 2)
    expect(overview.uncommitted).toBeCloseTo(15495, 2)
    expect(overview.uncommittedRatio).toBeCloseTo(0.77475, 5)
  })

  it('excludes archived and fully paid loans, archived bills, archived goals', () => {
    const overview = buildOverview({
      loans: [
        makeLoanPaying(1105),
        makeLoanPaying(900, { id: 'l2', archived: true }),
        makeLoanPaying(800, { id: 'l3', monthsPaid: 9, durationMonths: 9 }),
      ],
      bills: [makeBill({ amount: 1500 }), makeBill({ id: 'b2', amount: 999, archived: true })],
      goals: [makeGoal({ currentAmount: 500 }), makeGoal({ id: 'g2', currentAmount: 777, archived: true })],
      monthlyIncome: 20000,
    })

    expect(overview.loanCommitments).toBeCloseTo(1105, 2)
    expect(overview.billCommitments).toBe(1500)
    expect(overview.totalSavings).toBe(500)
  })

  it('reports runway in months of commitments', () => {
    const overview = buildOverview({
      loans: [makeLoanPaying(4662)],
      bills: [makeBill({ amount: 2800 })],
      goals: [makeGoal({ currentAmount: 500 })],
      monthlyIncome: 20000,
    })

    expect(overview.totalCommitments).toBeCloseTo(7462, 2)
    expect(overview.runwayMonths).toBeCloseTo(500 / 7462, 6)
  })

  it('falls back to income as the runway denominator when there are no commitments', () => {
    const overview = buildOverview({ loans: [], bills: [], goals: [makeGoal({ currentAmount: 10000 })], monthlyIncome: 20000 })
    expect(overview.runwayMonths).toBeCloseTo(0.5, 6)
  })

  it('returns zero runway and zero ratio when income and commitments are both zero', () => {
    const overview = buildOverview({ loans: [], bills: [], goals: [], monthlyIncome: 0 })
    expect(overview.runwayMonths).toBe(0)
    expect(overview.uncommittedRatio).toBe(0)
    expect(overview.uncommitted).toBe(0)
  })

  it('reports a negative uncommitted amount when over-committed', () => {
    const overview = buildOverview({
      loans: [makeLoanPaying(8000)],
      bills: [makeBill({ amount: 5000 })],
      goals: [],
      monthlyIncome: 10000,
    })

    expect(overview.uncommitted).toBeCloseTo(-3000, 2)
    expect(overview.uncommittedRatio).toBeCloseTo(-0.3, 5)
  })
})
