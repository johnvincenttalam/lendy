import type { Loan } from '../loans/loanTypes'
import type { Bill } from '../bills/billTypes'
import type { SavingsGoal } from '../savings/savingsTypes'
import type { FinancialOverview } from './financeTypes'
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
