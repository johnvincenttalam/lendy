import { describe, it, expect } from 'vitest'
import {
  buildOverview,
  interpolateScore,
  scoreDebtLoad,
  scoreCashFlow,
  scoreSavingsBuffer,
  isBackfilledPayment,
  scoreReliability,
  buildHealthScore,
  bandFor,
} from './financeUtils'
import type { Loan } from '../loans/loanTypes'
import type { Bill } from '../bills/billTypes'
import type { SavingsGoal } from '../savings/savingsTypes'
import type { FinancialOverview } from './financeTypes'
import type { PaymentRecord } from '../loans/loanTypes'
import type { BillPaymentRecord } from '../bills/billTypes'
import { paymentSchedule } from '../loans/loanUtils'

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

  it('describes the buffer against income, not commitments, when there are none', () => {
    // buildOverview swaps the runway denominator to income when there are no
    // commitments; the detail string must say so, not claim "commitments".
    const metric = scoreSavingsBuffer({ ...zeroOverview, monthlyIncome: 20000, totalCommitments: 0, runwayMonths: 0.5 })
    expect(metric.detail).toBe('0.5 months of income covered')
  })

  it('describes the buffer against commitments when they exist', () => {
    const metric = atRunway(2)
    expect(metric.detail).toBe('2.0 months of commitments covered')
  })
})

function makePayment(overrides: Partial<PaymentRecord> = {}): PaymentRecord {
  return {
    id: 'pay-1',
    loanId: 'loan-1',
    amount: 1105,
    principal: 1000,
    interest: 105,
    paidAt: '2026-01-01T09:30:00.000Z',
    dueDate: '2026-01-01',
    month: 1,
    ...overrides,
  }
}

function makeBillPayment(overrides: Partial<BillPaymentRecord> = {}): BillPaymentRecord {
  return {
    id: 'bp-1',
    billId: 'bill-1',
    amount: 1500,
    paidAt: '2026-01-01T09:30:00.000Z',
    dueDate: '2026-01-01',
    ...overrides,
  }
}

/** Reproduces exactly what migrateExistingPayments writes, for one month. */
function makeBackfilledPayment(loan: Loan, month: number): PaymentRecord {
  const scheduledDate = paymentSchedule(loan)[month - 1].date
  return makePayment({
    id: `backfill-${month}`,
    loanId: loan.id,
    paidAt: scheduledDate.toISOString(),
    dueDate: scheduledDate.toISOString().split('T')[0],
    month,
  })
}

describe('isBackfilledPayment', () => {
  it('identifies a record written by the payment migration', () => {
    const loan = makeLoan({ monthsPaid: 3 })
    expect(isBackfilledPayment(makeBackfilledPayment(loan, 1), loan)).toBe(true)
    expect(isBackfilledPayment(makeBackfilledPayment(loan, 3), loan)).toBe(true)
  })

  it('does not flag a real tap-time record', () => {
    const loan = makeLoan({ monthsPaid: 1 })
    const real = makePayment({ loanId: loan.id, month: 1, paidAt: '2026-01-01T09:30:12.345Z' })
    expect(isBackfilledPayment(real, loan)).toBe(false)
  })

  it('still identifies a backfilled record after the loan\'s start date is edited', () => {
    // Editing startDate on a migrated loan reshuffles paymentSchedule(), so the
    // schedule-based comparison alone would no longer match this record — the
    // exact failure mode this finding is about. The record-local check (dueDate
    // and paidAt both written from the same instant at migration time) doesn't
    // depend on the loan at all, so it still catches it.
    const loan = makeLoan({ monthsPaid: 3, startDate: '2026-01-01' })
    const backfilled = makeBackfilledPayment(loan, 1)
    const editedLoan = { ...loan, startDate: '2026-06-01' }

    expect(paymentSchedule(editedLoan)[0].date.toISOString()).not.toBe(backfilled.paidAt)
    expect(isBackfilledPayment(backfilled, editedLoan)).toBe(true)
  })
})

describe('scoreReliability', () => {
  const loan = makeLoan({ id: 'loan-1', durationMonths: 9, monthsPaid: 5 })

  it('is omitted when the evidence set is empty', () => {
    const metric = scoreReliability([loan], [], [], [])
    expect(metric.included).toBe(false)
    expect(metric.omissionReason).toBeTruthy()
  })

  it('ignores backfilled records entirely', () => {
    const backfilled = [1, 2, 3, 4, 5].map((m) => makeBackfilledPayment(loan, m))
    expect(scoreReliability([loan], backfilled, [], []).included).toBe(false)
  })

  it('is omitted at two records and included at three', () => {
    const two = [
      makePayment({ id: 'a', month: 1, dueDate: '2026-01-01', paidAt: '2026-01-01T10:00:00.000Z' }),
      makePayment({ id: 'b', month: 2, dueDate: '2026-02-01', paidAt: '2026-02-01T10:00:00.000Z' }),
    ]
    expect(scoreReliability([loan], two, [], []).included).toBe(false)

    const three = [...two, makePayment({ id: 'c', month: 3, dueDate: '2026-03-01', paidAt: '2026-03-01T10:00:00.000Z' })]
    const metric = scoreReliability([loan], three, [], [])
    expect(metric.included).toBe(true)
    expect(metric.score).toBe(100)
  })

  it('allows a three-day grace period and fails on the fourth', () => {
    const onTime = [
      makePayment({ id: 'a', month: 1, dueDate: '2026-01-01', paidAt: '2026-01-04T10:00:00.000Z' }),
      makePayment({ id: 'b', month: 2, dueDate: '2026-02-01', paidAt: '2026-02-04T10:00:00.000Z' }),
      makePayment({ id: 'c', month: 3, dueDate: '2026-03-01', paidAt: '2026-03-04T10:00:00.000Z' }),
    ]
    expect(scoreReliability([loan], onTime, [], []).score).toBe(100)

    const oneLate = [
      ...onTime.slice(0, 2),
      makePayment({ id: 'c', month: 3, dueDate: '2026-03-01', paidAt: '2026-03-05T10:00:00.000Z' }),
    ]
    expect(scoreReliability([loan], oneLate, [], []).score).toBe(67)
  })

  it('treats an early payment as on time', () => {
    const early = [
      makePayment({ id: 'a', month: 1, dueDate: '2026-01-10', paidAt: '2026-01-02T10:00:00.000Z' }),
      makePayment({ id: 'b', month: 2, dueDate: '2026-02-10', paidAt: '2026-02-02T10:00:00.000Z' }),
      makePayment({ id: 'c', month: 3, dueDate: '2026-03-10', paidAt: '2026-03-02T10:00:00.000Z' }),
    ]
    expect(scoreReliability([loan], early, [], []).score).toBe(100)
  })

  it('counts bill payments as evidence alongside loan payments', () => {
    const bills = [
      makeBillPayment({ id: 'bp1', dueDate: '2026-01-01', paidAt: '2026-01-01T10:00:00.000Z' }),
      makeBillPayment({ id: 'bp2', dueDate: '2026-02-01', paidAt: '2026-02-01T10:00:00.000Z' }),
      makeBillPayment({ id: 'bp3', dueDate: '2026-03-01', paidAt: '2026-03-01T10:00:00.000Z' }),
    ]
    const metric = scoreReliability([], [], [], bills)
    expect(metric.included).toBe(true)
    expect(metric.score).toBe(100)
  })

  it('collapses partial payments on one bill cycle into a single piece of evidence', () => {
    // Three ₱500 tranches of the same bill cycle (same billId, same dueDate)
    // must not, on their own, satisfy the 3-record evidence minimum — they
    // settle one obligation, not three.
    const tranches = [
      makeBillPayment({ id: 'bp1', billId: 'bill-1', dueDate: '2026-01-25', amount: 500, paidAt: '2026-01-20T10:00:00.000Z' }),
      makeBillPayment({ id: 'bp2', billId: 'bill-1', dueDate: '2026-01-25', amount: 500, paidAt: '2026-01-23T10:00:00.000Z' }),
      makeBillPayment({ id: 'bp3', billId: 'bill-1', dueDate: '2026-01-25', amount: 500, paidAt: '2026-01-25T10:00:00.000Z' }),
    ]
    expect(scoreReliability([], [], [], tranches).included).toBe(false)
  })

  it('scores a part-paid bill cycle on the tranche that settled it, not the earlier ones', () => {
    const tranches = [
      makeBillPayment({ id: 'bp1', billId: 'bill-1', dueDate: '2026-01-01', amount: 500, paidAt: '2025-12-20T10:00:00.000Z' }),
      // Settles 5 days after the due date — beyond the 3-day grace period.
      makeBillPayment({ id: 'bp2', billId: 'bill-1', dueDate: '2026-01-01', amount: 1000, paidAt: '2026-01-06T10:00:00.000Z' }),
    ]
    const otherBills = [
      makeBillPayment({ id: 'bp3', billId: 'bill-2', dueDate: '2026-02-01', paidAt: '2026-02-01T10:00:00.000Z' }),
      makeBillPayment({ id: 'bp4', billId: 'bill-3', dueDate: '2026-03-01', paidAt: '2026-03-01T10:00:00.000Z' }),
    ]
    const metric = scoreReliability([], [], [], [...tranches, ...otherBills])
    expect(metric.included).toBe(true)
    // 3 evidence entries after collapsing (bill-1 once, bill-2, bill-3); bill-1's
    // cycle settled late, so 2 of 3 are on time.
    expect(metric.detail).toBe('2 of 3 payments on time')
    expect(metric.score).toBe(67)
  })

  it('ignores payments belonging to an archived loan', () => {
    const archived = makeLoan({ id: 'loan-archived', archived: true })
    const late = [1, 2, 3].map((m) =>
      makePayment({
        id: `late-${m}`,
        loanId: 'loan-archived',
        month: m,
        dueDate: `2026-0${m}-01`,
        paidAt: `2026-0${m}-20T10:00:00.000Z`,
      }),
    )

    // On their own, three late records would score 0 and be included.
    expect(scoreReliability([archived], late, [], []).included).toBe(false)
  })

  it('ignores payments belonging to an archived bill', () => {
    const billPayments = [1, 2, 3].map((m) =>
      makeBillPayment({
        id: `bp${m}`,
        billId: 'bill-archived',
        dueDate: `2026-0${m}-01`,
        paidAt: `2026-0${m}-20T10:00:00.000Z`,
      }),
    )
    const bills = [makeBill({ id: 'bill-archived', archived: true })]

    expect(scoreReliability([], [], bills, billPayments).included).toBe(false)
  })

  it('keeps an archived loan from diluting the score of an active one', () => {
    const active = makeLoan({ id: 'loan-active' })
    const archived = makeLoan({ id: 'loan-archived', archived: true })
    const onTime = [1, 2, 3].map((m) =>
      makePayment({
        id: `ok${m}`,
        loanId: 'loan-active',
        month: m,
        dueDate: `2026-0${m}-01`,
        paidAt: `2026-0${m}-01T10:00:00.000Z`,
      }),
    )
    const archivedLate = [1, 2, 3].map((m) =>
      makePayment({
        id: `bad${m}`,
        loanId: 'loan-archived',
        month: m,
        dueDate: `2026-0${m}-01`,
        paidAt: `2026-0${m}-20T10:00:00.000Z`,
      }),
    )

    const metric = scoreReliability([active, archived], [...onTime, ...archivedLate], [], [])
    expect(metric.included).toBe(true)
    expect(metric.detail).toBe('3 of 3 payments on time')
    expect(metric.score).toBe(100)
  })
})

describe('buildHealthScore', () => {
  it('matches the worked example from the spec', () => {
    const overview = buildOverview({
      loans: [makeLoanPaying(4662)],
      bills: [makeBill({ amount: 2800 })],
      goals: [makeGoal({ currentAmount: 500 })],
      monthlyIncome: 20000,
    })

    const health = buildHealthScore(overview, [], [], [], [])

    const byKey = Object.fromEntries(health.metrics.map((m) => [m.key, m]))
    expect(byKey.debtLoad.score).toBe(69)
    expect(byKey.cashFlow.score).toBe(90)
    expect(byKey.savingsBuffer.score).toBe(2)
    expect(byKey.paymentReliability.included).toBe(false)

    // (69*30 + 90*25 + 2*30) / 85 = 51.53 -> 52
    expect(health.score).toBe(52)
    expect(health.band).toBe('needs-attention')
    expect(health.label).toBe('Needs Attention')
    expect(health.suppressed).toBe(false)
  })

  it('renormalises over the remaining weight when a metric is omitted', () => {
    // Reliability is omitted (no payment history); the other three carry
    // 30 + 25 + 30 = 85 points of weight between them. There's a loan so the
    // score isn't suppressed as "nothing to score" (see the suppression test below).
    //   Debt Load: 2,000 loan commitment / 20,000 income = 10% -> 100
    //   Cash Flow: uncommittedRatio = 18,000/20,000 = 90% -> capped at 90
    //   Savings Buffer: no goals, totalCommitments = 2,000 -> runway 0 -> 0
    // (100*30 + 90*25 + 0*30) / 85 = 5250 / 85 = 61.76 -> 62
    const overview = buildOverview({ loans: [makeLoanPaying(2000)], bills: [], goals: [], monthlyIncome: 20000 })
    const health = buildHealthScore(overview, [], [], [], [])
    const included = health.metrics.filter((m) => m.included)
    expect(included).toHaveLength(3)
    expect(included.reduce((sum, m) => sum + m.weight, 0)).toBe(85)
    expect(health.score).toBe(62)
    expect(health.suppressed).toBe(false)
  })

  it('suppresses the score entirely when there is no income', () => {
    const overview = buildOverview({ loans: [makeLoan()], bills: [], goals: [], monthlyIncome: 0 })
    const health = buildHealthScore(overview, [], [], [], [])
    expect(health.suppressed).toBe(true)
    expect(health.suppressedReason).toBe('no-income')
    expect(health.score).toBe(0)
  })

  it('suppresses the score when income is set but there are no commitments and no savings', () => {
    // A near-empty install: income set, no loans, no bills, no goals. Debt Load
    // would otherwise award 100 for the absence of loans, and Cash Flow 90 for
    // an uncommittedRatio of 1.0, producing a misleadingly high score for a
    // user who has recorded nothing at all.
    const overview = buildOverview({ loans: [], bills: [], goals: [], monthlyIncome: 20000 })
    const health = buildHealthScore(overview, [], [], [], [])
    expect(health.suppressed).toBe(true)
    expect(health.suppressedReason).toBe('no-data')
    expect(health.score).toBe(0)
  })

  it('is not suppressed when there are no commitments but there are savings', () => {
    const overview = buildOverview({ loans: [], bills: [], goals: [makeGoal({ currentAmount: 500 })], monthlyIncome: 20000 })
    const health = buildHealthScore(overview, [], [], [], [])
    expect(health.suppressed).toBe(false)
  })

  it('always returns all four metrics, included or not', () => {
    const overview = buildOverview({ loans: [], bills: [], goals: [], monthlyIncome: 0 })
    expect(buildHealthScore(overview, [], [], [], []).metrics).toHaveLength(4)
  })

  it('never returns a negative score when over-committed', () => {
    const overview = buildOverview({
      loans: [makeLoanPaying(9000)],
      bills: [makeBill({ amount: 6000 })],
      goals: [],
      monthlyIncome: 10000,
    })
    const health = buildHealthScore(overview, [], [], [], [])
    expect(health.score).toBeGreaterThanOrEqual(0)
    expect(health.band).toBe('at-risk')
  })

  it('maps scores to bands at their edges', () => {
    expect(bandFor(0)).toBe('at-risk')
    expect(bandFor(39)).toBe('at-risk')
    expect(bandFor(40)).toBe('needs-attention')
    expect(bandFor(59)).toBe('needs-attention')
    expect(bandFor(60)).toBe('stable')
    expect(bandFor(79)).toBe('stable')
    expect(bandFor(80)).toBe('healthy')
    expect(bandFor(100)).toBe('healthy')
  })
})
