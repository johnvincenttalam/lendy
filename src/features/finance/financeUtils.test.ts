import { describe, it, expect } from 'vitest'
import { buildOverview, interpolateScore, scoreDebtLoad, scoreCashFlow, scoreSavingsBuffer } from './financeUtils'
import type { Loan } from '../loans/loanTypes'
import type { Bill } from '../bills/billTypes'
import type { SavingsGoal } from '../savings/savingsTypes'
import type { FinancialOverview } from './financeTypes'

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

const zeroOverview: FinancialOverview = {
  monthlyIncome: 0,
  loanCommitments: 0,
  billCommitments: 0,
  totalCommitments: 0,
  uncommitted: 0,
  uncommittedRatio: 0,
  totalDebt: 0,
  totalSavings: 0,
  runwayMonths: 0,
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

describe('interpolateScore', () => {
  const points = [[0, 0], [1, 25], [3, 60]] as const

  it('clamps below the first point', () => {
    expect(interpolateScore(-5, points)).toBe(0)
  })

  it('clamps above the last point', () => {
    expect(interpolateScore(99, points)).toBe(60)
  })

  it('returns the exact score at a breakpoint', () => {
    expect(interpolateScore(1, points)).toBe(25)
  })

  it('interpolates linearly between breakpoints', () => {
    expect(interpolateScore(2, points)).toBeCloseTo(42.5, 6)
  })
})

describe('scoreDebtLoad', () => {
  function atRatio(ratio: number) {
    return scoreDebtLoad({ ...zeroOverview, monthlyIncome: 20000, loanCommitments: 20000 * ratio })
  }

  it('scores 100 at or below 10% of income', () => {
    expect(atRatio(0.05).score).toBe(100)
    expect(atRatio(0.10).score).toBe(100)
  })

  it('scores the conventional DTI ceilings at their band edges', () => {
    expect(atRatio(0.20).score).toBe(75)
    expect(atRatio(0.36).score).toBe(45)
    expect(atRatio(0.43).score).toBe(25)
    expect(atRatio(0.50).score).toBe(10)
  })

  it('scores 0 at or above 70%', () => {
    expect(atRatio(0.70).score).toBe(0)
    expect(atRatio(0.95).score).toBe(0)
  })

  it('interpolates inside a band', () => {
    // 23.31% sits 20.69% of the way from 0.20 to 0.36, so 75 - 6.21 = 68.79 -> 69
    expect(atRatio(0.2331).score).toBe(69)
  })

  it('ignores bills entirely', () => {
    const withBills = scoreDebtLoad({ ...zeroOverview, monthlyIncome: 20000, loanCommitments: 4000, billCommitments: 9000 })
    const withoutBills = scoreDebtLoad({ ...zeroOverview, monthlyIncome: 20000, loanCommitments: 4000 })
    expect(withBills.score).toBe(withoutBills.score)
  })

  it('is omitted when there is no income', () => {
    const metric = scoreDebtLoad({ ...zeroOverview, monthlyIncome: 0, loanCommitments: 4000 })
    expect(metric.included).toBe(false)
    expect(metric.omissionReason).toBeTruthy()
  })
})

describe('scoreCashFlow', () => {
  function atRatio(ratio: number) {
    return scoreCashFlow({ ...zeroOverview, monthlyIncome: 20000, uncommittedRatio: ratio })
  }

  it('caps at 90 and never reaches 100', () => {
    expect(atRatio(0.60).score).toBe(90)
    expect(atRatio(0.99).score).toBe(90)
  })

  it('scores band edges', () => {
    expect(atRatio(0.50).score).toBe(75)
    expect(atRatio(0.35).score).toBe(50)
    expect(atRatio(0.25).score).toBe(30)
    expect(atRatio(0.10).score).toBe(10)
  })

  it('scores 0 when over-committed', () => {
    expect(atRatio(-0.3).score).toBe(0)
    expect(atRatio(0).score).toBe(0)
  })

  it('is omitted when there is no income', () => {
    expect(scoreCashFlow({ ...zeroOverview, monthlyIncome: 0 }).included).toBe(false)
  })
})

describe('scoreSavingsBuffer', () => {
  function atRunway(months: number) {
    return scoreSavingsBuffer({ ...zeroOverview, monthlyIncome: 20000, totalCommitments: 7462, runwayMonths: months })
  }

  it('scores 0 with no savings', () => {
    expect(atRunway(0).score).toBe(0)
  })

  it('scores band edges', () => {
    expect(atRunway(1).score).toBe(25)
    expect(atRunway(3).score).toBe(60)
    expect(atRunway(6).score).toBe(90)
    expect(atRunway(12).score).toBe(100)
  })

  it('caps at 100 beyond a year of runway', () => {
    expect(atRunway(40).score).toBe(100)
  })

  it('scores a near-empty buffer close to zero', () => {
    expect(atRunway(500 / 7462).score).toBe(2)
  })

  it('is omitted when there is neither income nor commitments to measure against', () => {
    const metric = scoreSavingsBuffer({ ...zeroOverview, monthlyIncome: 0, totalCommitments: 0 })
    expect(metric.included).toBe(false)
  })

  it('is included with no commitments as long as there is income', () => {
    expect(scoreSavingsBuffer({ ...zeroOverview, monthlyIncome: 20000, totalCommitments: 0, runwayMonths: 0.5 }).included).toBe(true)
  })
})
