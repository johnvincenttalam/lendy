import type { Loan } from '../loans/loanTypes'
import type { Bill } from '../bills/billTypes'
import type { SavingsGoal } from '../savings/savingsTypes'
import type { FinancialOverview, MetricScore } from './financeTypes'
import { scheduledMonthlyPayment, remainingBalance, isFullyPaid } from '../loans/loanUtils'

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

  return {
    ...base,
    score: Math.round(interpolateScore(overview.runwayMonths, SAVINGS_BUFFER_POINTS)),
    detail: `${overview.runwayMonths.toFixed(1)} months of commitments covered`,
    included: true,
  }
}
