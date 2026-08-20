import type { Loan, PaymentRecord } from '../loans/loanTypes'
import type { Bill, BillPaymentRecord } from '../bills/billTypes'
import type { SavingsGoal } from '../savings/savingsTypes'
import type { FinancialOverview, MetricScore, HealthScore, ScoreBandName } from './financeTypes'
import { scheduledMonthlyPayment, remainingBalance, isFullyPaid, paymentSchedule } from '../loans/loanUtils'
import { daysBetween } from '../../utils/dateUtils'

export type OverviewInput = {
  loans: Loan[]
  bills: Bill[]
  goals: SavingsGoal[]
  monthlyIncome: number
}

export function buildOverview({ loans, bills, goals, monthlyIncome }: OverviewInput): FinancialOverview {
  const activeLoans = loans.filter((l) => !l.archived && !isFullyPaid(l))

  // scheduledMonthlyPayment, not loan.monthlyPayment: the stored field is
  // hand-entered and drifts from the amount/rate/tenure beside it.
  const loanCommitments = activeLoans.reduce((sum, l) => sum + scheduledMonthlyPayment(l), 0)

  // Gross amount, not remainingForCycle: a commitment is what recurs every
  // month. A part-paid electricity bill still costs its full amount next month.
  const billCommitments = bills.filter((b) => !b.archived).reduce((sum, b) => sum + b.amount, 0)
  const totalCommitments = loanCommitments + billCommitments

  const uncommitted = monthlyIncome - totalCommitments
  const uncommittedRatio = monthlyIncome > 0 ? uncommitted / monthlyIncome : 0

  const totalDebt = activeLoans.reduce((sum, l) => sum + remainingBalance(l), 0)
  const totalSavings = goals.filter((g) => !g.archived).reduce((sum, g) => sum + g.currentAmount, 0)

  // No commitments yet? Measure the buffer against income instead, so a user
  // with savings and no debt isn't scored against a zero denominator.
  const runwayDenominator = totalCommitments > 0 ? totalCommitments : monthlyIncome
  const runwayMonths = runwayDenominator > 0 ? totalSavings / runwayDenominator : 0

  return {
    monthlyIncome,
    loanCommitments,
    billCommitments,
    totalCommitments,
    uncommitted,
    uncommittedRatio,
    totalDebt,
    totalSavings,
    runwayMonths,
  }
}

/**
 * Breakpoint tables: [input, score] pairs sorted ascending by input.
 * Values between two points interpolate linearly; values outside the table
 * clamp to the nearest end. Interpolating (rather than stepping) keeps the
 * score moving smoothly as balances change instead of jumping at edges.
 */
const DEBT_LOAD_POINTS = [
  [0.10, 100],
  [0.20, 75],
  [0.36, 45], // conventional DTI ceiling
  [0.43, 25], // qualified-mortgage ceiling
  [0.50, 10],
  [0.70, 0],
] as const

const CASH_FLOW_POINTS = [
  [0, 0],
  [0.10, 10],
  [0.25, 30],
  [0.35, 50],
  [0.50, 75],
  [0.60, 90], // capped at 90: untracked living costs mean this can never be a perfect score
] as const

const SAVINGS_BUFFER_POINTS = [
  [0, 0],
  [1, 25],
  [3, 60],
  [6, 90],
  [12, 100],
] as const

export function interpolateScore(value: number, points: ReadonlyArray<readonly [number, number]>): number {
  const first = points[0]
  const last = points[points.length - 1]
  if (value <= first[0]) return first[1]
  if (value >= last[0]) return last[1]

  for (let i = 1; i < points.length; i++) {
    const [prevInput, prevScore] = points[i - 1]
    const [currInput, currScore] = points[i]
    if (value <= currInput) {
      const t = (value - prevInput) / (currInput - prevInput)
      return prevScore + t * (currScore - prevScore)
    }
  }

  return last[1]
}

const NO_INCOME = 'Set your monthly income to unlock this'

export function scoreDebtLoad(overview: FinancialOverview): MetricScore {
  const base = { key: 'debtLoad', label: 'Debt Load', weight: 30 } as const

  if (overview.monthlyIncome <= 0) {
    return { ...base, score: 0, detail: 'No income set', included: false, omissionReason: NO_INCOME }
  }

  // Bills are deliberately excluded: folding utilities into a "debt" measure
  // overstates debt and breaks comparability with lending DTI thresholds.
  const ratio = overview.loanCommitments / overview.monthlyIncome

  return {
    ...base,
    score: Math.round(interpolateScore(ratio, DEBT_LOAD_POINTS)),
    detail: `${(ratio * 100).toFixed(1)}% of income goes to loans`,
    included: true,
  }
}

export function scoreCashFlow(overview: FinancialOverview): MetricScore {
  const base = { key: 'cashFlow', label: 'Cash Flow', weight: 25 } as const

  if (overview.monthlyIncome <= 0) {
    return { ...base, score: 0, detail: 'No income set', included: false, omissionReason: NO_INCOME }
  }

  const ratio = overview.uncommittedRatio

  return {
    ...base,
    score: Math.round(interpolateScore(ratio, CASH_FLOW_POINTS)),
    detail: `${(ratio * 100).toFixed(1)}% of income is uncommitted`,
    included: true,
  }
}

export function scoreSavingsBuffer(overview: FinancialOverview): MetricScore {
  const base = { key: 'savingsBuffer', label: 'Savings Buffer', weight: 30 } as const

  if (overview.totalCommitments <= 0 && overview.monthlyIncome <= 0) {
    return {
      ...base,
      score: 0,
      detail: 'Nothing to measure against yet',
      included: false,
      omissionReason: 'Add a bill, a loan, or your income to measure your buffer',
    }
  }

  // buildOverview swaps runwayMonths' denominator to income when there are no
  // commitments, so the detail string must follow — otherwise a user with no
  // debt and no bills reads "months of commitments covered" while having none.
  const denominatorLabel = overview.totalCommitments > 0 ? 'commitments' : 'income'

  return {
    ...base,
    score: Math.round(interpolateScore(overview.runwayMonths, SAVINGS_BUFFER_POINTS)),
    detail: `${overview.runwayMonths.toFixed(1)} months of ${denominatorLabel} covered`,
    included: true,
  }
}

/** paidAt records when the user tapped the button, not when money moved, so the lag is systematic and always late. */
const GRACE_DAYS = 3

const MIN_EVIDENCE = 3

/**
 * migrateExistingPayments (loanStore.ts) backfills records for loans that
 * predate the payments feature, writing paidAt as exactly the scheduled date.
 * Counted as evidence they would report a flawless on-time history for every
 * migrated loan. A real record comes from new Date() at tap time and will not
 * match the schedule to the millisecond.
 *
 * Two independent checks, both kept:
 *
 * 1. Schedule-based: recompute paymentSchedule(loan) and compare. This is
 *    what shipped first, but updateLoan never touches PaymentRecords, and the
 *    schedule depends only on startDate — so editing a migrated loan's start
 *    date makes every one of its backfilled records stop matching and look
 *    like real, on-time evidence.
 * 2. Record-local: the migration writes dueDate as paidAt's calendar day, so
 *    a migrated record can be identified from its own two fields, with no
 *    dependency on the loan at all — immune to the start-date edit above.
 *    This holds because startDate is a bare YYYY-MM-DD parsed as UTC
 *    midnight and the target timezone (UTC+8) has no DST, so the schedule
 *    date's ISO string always lands on T00:00:00.000Z. In a DST timezone the
 *    two forms of a migrated date can disagree by an hour, which is why the
 *    schedule-based check above is retained rather than replaced.
 */
export function isBackfilledPayment(payment: PaymentRecord, loan: Loan): boolean {
  const scheduled = paymentSchedule(loan)[payment.month - 1]
  const matchesSchedule = scheduled
    ? scheduled.date.toISOString() === payment.paidAt
    // The migration falls back to the loan start date when the schedule is short.
    : new Date(loan.startDate).toISOString() === payment.paidAt

  return matchesSchedule || payment.paidAt === new Date(payment.dueDate).toISOString()
}

function isOnTime(dueDate: string, paidAt: string): boolean {
  // daysBetween normalises both sides to local midnight, matching how
  // isBillOverdue already compares an ISO date against a timestamp.
  return daysBetween(dueDate, paidAt) <= GRACE_DAYS
}

/**
 * recordBillPayment (billStore.ts) appends one BillPaymentRecord per
 * instalment and holds the bill's cycle open until payments cover its
 * amount, so a bill paid in several tranches produces several records
 * sharing one dueDate. Scored individually, each tranche is a separate piece
 * of evidence and a separate late/on-time verdict for what is really one
 * obligation. Collapse to one entry per (billId, dueDate) cycle, keeping the
 * payment with the latest paidAt — the one that actually settled the cycle.
 */
function collapseBillEvidence(billPayments: BillPaymentRecord[]): Array<{ dueDate: string; paidAt: string }> {
  const latestByCycle = new Map<string, BillPaymentRecord>()
  for (const payment of billPayments) {
    const key = `${payment.billId}|${payment.dueDate}`
    const current = latestByCycle.get(key)
    if (!current || payment.paidAt > current.paidAt) latestByCycle.set(key, payment)
  }
  return [...latestByCycle.values()].map((p) => ({ dueDate: p.dueDate, paidAt: p.paidAt }))
}

export function scoreReliability(
  loans: Loan[],
  payments: PaymentRecord[],
  billPayments: BillPaymentRecord[],
): MetricScore {
  const base = { key: 'paymentReliability', label: 'Payment Reliability', weight: 15 } as const

  const loansById = new Map(loans.map((l) => [l.id, l]))
  const realLoanPayments = payments.filter((p) => {
    const loan = loansById.get(p.loanId)
    return loan ? !isBackfilledPayment(p, loan) : true
  })

  // Bills shipped with recordBillPayment and were never backfilled, so all
  // count — but a partially-paid bill's instalments are collapsed to one
  // piece of evidence first (see collapseBillEvidence).
  const evidence: Array<{ dueDate: string; paidAt: string }> = [
    ...realLoanPayments.map((p) => ({ dueDate: p.dueDate, paidAt: p.paidAt })),
    ...collapseBillEvidence(billPayments),
  ]

  if (evidence.length < MIN_EVIDENCE) {
    return {
      ...base,
      score: 0,
      detail: 'Not enough payment history yet',
      included: false,
      omissionReason: `Needs at least ${MIN_EVIDENCE} recorded payments`,
    }
  }

  const onTime = evidence.filter((e) => isOnTime(e.dueDate, e.paidAt)).length

  return {
    ...base,
    score: Math.round((onTime / evidence.length) * 100),
    detail: `${onTime} of ${evidence.length} payments on time`,
    included: true,
  }
}

const BAND_LABELS: Record<ScoreBandName, string> = {
  'at-risk': 'At Risk',
  'needs-attention': 'Needs Attention',
  stable: 'Stable',
  healthy: 'Healthy',
}

export function bandFor(score: number): ScoreBandName {
  if (score < 40) return 'at-risk'
  if (score < 60) return 'needs-attention'
  if (score < 80) return 'stable'
  return 'healthy'
}

export function buildHealthScore(
  overview: FinancialOverview,
  loans: Loan[],
  payments: PaymentRecord[],
  billPayments: BillPaymentRecord[],
): HealthScore {
  const metrics: MetricScore[] = [
    scoreDebtLoad(overview),
    scoreCashFlow(overview),
    scoreSavingsBuffer(overview),
    scoreReliability(loans, payments, billPayments),
  ]

  // Without income, Debt Load and Cash Flow both drop out — 55 of 100 points.
  // A number built from the remainder would mislead, so publish no number.
  if (overview.monthlyIncome <= 0) {
    return {
      score: 0,
      band: 'at-risk',
      label: BAND_LABELS['at-risk'],
      metrics,
      suppressed: true,
      suppressedReason: 'no-income',
    }
  }

  // Income is set but there's nothing to score against: no commitments and no
  // savings. Debt Load defaults to a perfect 100 for the *absence* of loans,
  // which is a fresh install's default state — publishing that number would
  // outrank a user who is actually servicing debt on schedule.
  if (overview.totalCommitments === 0 && overview.totalSavings === 0) {
    return {
      score: 0,
      band: 'at-risk',
      label: BAND_LABELS['at-risk'],
      metrics,
      suppressed: true,
      suppressedReason: 'no-data',
    }
  }

  const included = metrics.filter((m) => m.included)
  const totalWeight = included.reduce((sum, m) => sum + m.weight, 0)

  // Metric scores are already rounded. Aggregating from the rounded values —
  // rather than from full precision — costs at most a point but lets the user
  // add up the breakdown on screen and arrive at the number on screen.
  const weighted = included.reduce((sum, m) => sum + m.score * m.weight, 0)
  const score = totalWeight > 0 ? Math.max(0, Math.min(100, Math.round(weighted / totalWeight))) : 0
  const band = bandFor(score)

  return { score, band, label: BAND_LABELS[band], metrics, suppressed: false, suppressedReason: null }
}
