import { useMemo } from 'react'
import { CreditCard, CalendarCheck, TrendingUp, Wallet } from 'lucide-react'
import { useLoanStore } from '../loans/loanStore'
import { useIncomeStore } from '../finance/incomeStore'
import {
  remainingBalance, isFullyPaid, progress, debtFreeDate, totalInterestAllLoans, debtToIncomeRatio,
  totalCostOfLoan, monthlyLoanPayments, isTracked,
} from '../loans/loanUtils'
import CurrencyAmount from '../../components/CurrencyAmount'
import ProgressBar from '../../components/ProgressBar'
import StatTile from './StatTile'

/** What's left to pay on regular loans, with a payoff bar and key stats. Hidden with no regular loans. */
export default function MoneySummaryWidget() {
  const loans = useLoanStore((s) => s.loans)
  const monthlyIncome = useIncomeStore((s) => s.monthlyIncome)
  const activeLoans = useMemo(() => loans.filter(isTracked), [loans])

  const { totalDebt, totalMonthly, paidRatio, loanCount } = useMemo(() => {
    // Weighted by each loan's schedule progress (months paid), the same
    // measure the loan cards show as "% complete".
    const totalCost = activeLoans.reduce((sum, l) => sum + totalCostOfLoan(l), 0)
    const totalPaid = activeLoans.reduce((sum, l) => sum + progress(l) * totalCostOfLoan(l), 0)
    return {
      totalDebt: activeLoans.reduce((sum, l) => sum + remainingBalance(l), 0),
      totalMonthly: monthlyLoanPayments(activeLoans),
      paidRatio: totalCost > 0 ? totalPaid / totalCost : 0,
      loanCount: activeLoans.filter((l) => !isFullyPaid(l)).length,
    }
  }, [activeLoans])

  if (activeLoans.length === 0) return null

  const hasIncome = monthlyIncome > 0
  const dtiPercent = Math.round(debtToIncomeRatio(activeLoans, monthlyIncome) * 100)
  const dtiColor =
    dtiPercent > 50 ? 'text-red-600 dark:text-red-400' : dtiPercent > 30 ? 'text-amber-700 dark:text-amber-400' : 'text-emerald-700 dark:text-emerald-400'
  const paidPercent = Math.round(Math.min(1, Math.max(0, paidRatio)) * 100)
  const freeOn = debtFreeDate(activeLoans)

  return (
    <section aria-label="Money summary" className="space-y-3">
      <div className="rounded-3xl bg-card p-5">
        <p className="text-[13px] font-bold text-muted">Left to pay</p>
        <p className="text-[40px] font-extrabold font-display tabular-nums text-primary tracking-tight leading-none mt-1">
          <CurrencyAmount value={totalDebt} />
        </p>
        {loanCount > 0 && (
          <>
            <ProgressBar value={paidPercent} label="Paid off" size="md" className="mt-5" />
            <div className="flex justify-between mt-2 text-[13px] font-semibold">
              <span className="text-primary">{paidPercent}% paid off</span>
              <span className="text-muted">{loanCount} active {loanCount === 1 ? 'loan' : 'loans'}</span>
            </div>
          </>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <StatTile icon={CreditCard} label="Monthly" tint="var(--tint-teal)">
          <CurrencyAmount value={totalMonthly} />
        </StatTile>
        <StatTile icon={CalendarCheck} label="Debt-free" tint="var(--tint-amber)">
          {freeOn ? freeOn.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : 'Now'}
        </StatTile>
        {loanCount > 0 && (
          <StatTile icon={TrendingUp} label="Total interest" tint="var(--tint-red)" wide={!hasIncome}>
            <CurrencyAmount value={totalInterestAllLoans(activeLoans)} />
          </StatTile>
        )}
        {loanCount > 0 && hasIncome && (
          <StatTile icon={Wallet} label="Of your income" tint="var(--tint-neutral)">
            <span className={dtiColor}>{dtiPercent}%</span>
          </StatTile>
        )}
      </div>
    </section>
  )
}
