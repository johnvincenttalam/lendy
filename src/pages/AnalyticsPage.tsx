import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Flame, Target, TrendingDown, DollarSign, AlertTriangle, BarChart3,
} from 'lucide-react'
import { useLoanStore } from '../features/loans/loanStore'
import EmptyState from '../components/EmptyState'
import {
  formatCurrency, isFullyPaid, totalInterestOverLife, totalCostOfLoan,
  interestPaidSoFar, remainingBalance, debtFreeDate, monthsLeft,
} from '../features/loans/loanUtils'
import type { Loan } from '../features/loans/loanTypes'
import { DEFAULT_COLOR } from '../features/loans/loanTypes'
import { BRAND_GRADIENT } from '../constants/styles'

function computePaymentStreak(loans: Loan[]): number {
  // Streak = sum of consecutive paid months from latest across all active loans
  // Simple approach: longest active streak among all loans
  let maxStreak = 0
  for (const loan of loans) {
    if (loan.monthsPaid > maxStreak) maxStreak = loan.monthsPaid
  }
  // Total consecutive payments across all loans
  return loans.reduce((sum, l) => sum + l.monthsPaid, 0)
}

function computeDebtBurdenTimeline(loans: Loan[]): Array<{ label: string; amount: number }> {
  const active = loans.filter((l) => !isFullyPaid(l))
  if (active.length === 0) return []

  const now = new Date()
  const startMonth = new Date(now.getFullYear(), now.getMonth(), 1)

  // Find max months remaining
  let maxMonths = 0
  for (const loan of active) {
    const left = monthsLeft(loan)
    if (left > maxMonths) maxMonths = left
  }

  const points: Array<{ label: string; amount: number }> = []
  const step = Math.max(1, Math.floor(maxMonths / 8))

  for (let m = 0; m <= maxMonths; m += step) {
    const date = new Date(startMonth)
    date.setMonth(date.getMonth() + m)

    let totalMonthly = 0
    for (const loan of active) {
      const paidByThen = loan.monthsPaid + m
      if (paidByThen < loan.durationMonths) {
        totalMonthly += loan.monthlyPayment
      }
    }

    points.push({
      label: date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
      amount: totalMonthly,
    })
  }

  // Ensure last point is included
  if (points.length > 0 && points[points.length - 1].amount !== 0) {
    const endDate = new Date(startMonth)
    endDate.setMonth(endDate.getMonth() + maxMonths)
    points.push({
      label: endDate.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
      amount: 0,
    })
  }

  return points
}

function computeLoanCostRanking(loans: Loan[]): Array<{ loan: Loan; totalInterest: number; costRatio: number }> {
  return loans
    .filter((l) => l.interestRate > 0)
    .map((loan) => ({
      loan,
      totalInterest: totalInterestOverLife(loan),
      costRatio: totalInterestOverLife(loan) / loan.totalAmount,
    }))
    .sort((a, b) => b.totalInterest - a.totalInterest)
}

export default function AnalyticsPage() {
  const navigate = useNavigate()
  const { loans } = useLoanStore()

  const activeLoans = useMemo(() => loans.filter((l) => !isFullyPaid(l)), [loans])

  // 1. Interest vs Principal
  const totalPrincipalPaid = useMemo(
    () => loans.reduce((sum, l) => sum + l.totalPaid - interestPaidSoFar(l), 0),
    [loans],
  )
  const totalInterestPaid = useMemo(
    () => loans.reduce((sum, l) => sum + interestPaidSoFar(l), 0),
    [loans],
  )
  const totalPaid = totalPrincipalPaid + totalInterestPaid
  const interestPercent = totalPaid > 0 ? Math.round((totalInterestPaid / totalPaid) * 100) : 0
  const principalPercent = 100 - interestPercent

  // Lifetime totals
  const lifetimePrincipal = useMemo(() => loans.reduce((sum, l) => sum + l.totalAmount, 0), [loans])
  const lifetimeInterest = useMemo(() => loans.reduce((sum, l) => sum + totalInterestOverLife(l), 0), [loans])
  const lifetimeTotal = useMemo(() => loans.reduce((sum, l) => sum + totalCostOfLoan(l), 0), [loans])

  // 2. Debt-free countdown
  const debtFree = useMemo(() => debtFreeDate(loans), [loans])
  const totalMonthsLeft = useMemo(
    () => activeLoans.reduce((max, l) => Math.max(max, monthsLeft(l)), 0),
    [activeLoans],
  )
  const totalRemainingDebt = useMemo(
    () => activeLoans.reduce((sum, l) => sum + remainingBalance(l), 0),
    [activeLoans],
  )

  // 3. Payment streak
  const streak = useMemo(() => computePaymentStreak(loans), [loans])

  // 4. Debt burden trend
  const burdenTimeline = useMemo(() => computeDebtBurdenTimeline(loans), [loans])
  const currentBurden = burdenTimeline.length > 0 ? burdenTimeline[0].amount : 0
  const maxBurden = burdenTimeline.reduce((max, p) => Math.max(max, p.amount), 0)

  // 5. Loan cost ranking
  const costRanking = useMemo(() => computeLoanCostRanking(loans), [loans])

  if (loans.length === 0) {
    return (
      <div className="min-h-screen bg-page transition-colors duration-300">
        <div style={{ background: BRAND_GRADIENT }}>
          <div className="max-w-2xl mx-auto px-4 pt-5 pb-5">
            <h1 className="text-[22px] font-bold text-white tracking-tight">Analytics</h1>
          </div>
        </div>
        <EmptyState
          icon={BarChart3}
          title="No data yet"
          subtitle="Add loans to see your analytics"
        />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-page transition-colors duration-300">
      {/* Header */}
      <div style={{ background: BRAND_GRADIENT }}>
        <div className="max-w-2xl mx-auto px-4 pt-5 pb-5">
          <div className="mb-4">
            <h1 className="text-[22px] font-bold text-white tracking-tight leading-tight">Analytics</h1>
            <p className="text-[12px] text-white/55 font-medium">Smart insights on your loans</p>
          </div>

          {/* Payment streak */}
          <div className="rounded-2xl bg-white/[0.13] backdrop-blur-sm border border-white/[0.12] p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-[13px] bg-white/15 flex items-center justify-center">
                <Flame className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1">
                <p className="text-[11px] font-semibold text-white/55 uppercase tracking-wider">Payment Streak</p>
                <p className="text-[28px] font-bold text-white tracking-tight leading-tight">
                  {streak} <span className="text-[14px] font-semibold text-white/60">payments made</span>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 pt-4 pb-28 space-y-4">
        {/* Debt-free countdown */}
        <div className="bg-card rounded-2xl border border-themed p-4 transition-colors">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="w-8 h-8 rounded-[11px] bg-emerald-500/10 flex items-center justify-center">
              <Target className="w-4 h-4 text-emerald-500" />
            </div>
            <h3 className="font-bold text-primary text-[15px] tracking-tight">Debt-Free Countdown</h3>
          </div>
          {debtFree ? (
            <div className="space-y-3">
              <div className="text-center py-2">
                <p className="text-[36px] font-bold text-primary tracking-tighter leading-none">
                  {totalMonthsLeft}
                </p>
                <p className="text-[13px] text-muted mt-1">months remaining</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-subtle rounded-xl p-3">
                  <p className="text-[10px] font-semibold text-muted uppercase tracking-widest mb-1">Target Date</p>
                  <p className="text-[14px] font-bold text-primary tracking-tight">
                    {debtFree.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                  </p>
                </div>
                <div className="bg-subtle rounded-xl p-3">
                  <p className="text-[10px] font-semibold text-muted uppercase tracking-widest mb-1">Remaining</p>
                  <p className="text-[14px] font-bold text-primary tracking-tight">{formatCurrency(totalRemainingDebt)}</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-4">
              <p className="text-[20px] font-bold text-emerald-500 tracking-tight">You're debt-free!</p>
            </div>
          )}
        </div>

        {/* Interest vs Principal */}
        <div className="bg-card rounded-2xl border border-themed p-4 transition-colors">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="w-8 h-8 rounded-[11px] bg-brand/10 flex items-center justify-center">
              <DollarSign className="w-4 h-4 text-brand" />
            </div>
            <h3 className="font-bold text-primary text-[15px] tracking-tight">Where Your Money Goes</h3>
          </div>

          {totalPaid > 0 ? (
            <>
              {/* Bar */}
              <div className="w-full h-3 rounded-full overflow-hidden flex mb-3">
                <div
                  className="h-full transition-all duration-700"
                  style={{ width: `${principalPercent}%`, backgroundColor: '#10B981' }}
                />
                <div
                  className="h-full transition-all duration-700"
                  style={{ width: `${interestPercent}%`, backgroundColor: '#EF4444' }}
                />
              </div>

              {/* Legend */}
              <div className="flex justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  <span className="text-[12px] text-secondary">Principal <span className="font-bold text-primary">{principalPercent}%</span></span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
                  <span className="text-[12px] text-secondary">Interest <span className="font-bold text-primary">{interestPercent}%</span></span>
                </div>
              </div>

              {/* Paid so far */}
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div className="bg-subtle rounded-xl p-3">
                  <p className="text-[10px] font-semibold text-muted uppercase tracking-widest mb-1">Principal Paid</p>
                  <p className="text-[14px] font-bold text-emerald-500 tracking-tight">{formatCurrency(totalPrincipalPaid)}</p>
                </div>
                <div className="bg-subtle rounded-xl p-3">
                  <p className="text-[10px] font-semibold text-muted uppercase tracking-widest mb-1">Interest Paid</p>
                  <p className="text-[14px] font-bold text-red-500 tracking-tight">{formatCurrency(totalInterestPaid)}</p>
                </div>
              </div>
            </>
          ) : (
            <p className="text-[13px] text-muted text-center py-3">No payments recorded yet</p>
          )}

          {/* Lifetime totals */}
          <div className="pt-3 border-t border-divider">
            <p className="text-[10px] font-semibold text-muted uppercase tracking-widest mb-2">Lifetime Totals (All Loans)</p>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-[13px] text-secondary">Borrowed</span>
                <span className="text-[13px] font-bold text-primary">{formatCurrency(lifetimePrincipal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[13px] text-secondary">Total Interest</span>
                <span className="text-[13px] font-bold text-red-500">{formatCurrency(lifetimeInterest)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[13px] text-secondary">Total Cost</span>
                <span className="text-[13px] font-bold text-primary">{formatCurrency(lifetimeTotal)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Monthly Debt Burden Trend */}
        {burdenTimeline.length > 1 && (
          <div className="bg-card rounded-2xl border border-themed p-4 transition-colors">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-8 h-8 rounded-[11px] bg-blue-500/10 flex items-center justify-center">
                <TrendingDown className="w-4 h-4 text-blue-500" />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-primary text-[15px] tracking-tight">Monthly Burden</h3>
                <p className="text-[11px] text-muted">Your total monthly payment over time</p>
              </div>
              <span className="text-[14px] font-bold text-primary tracking-tight">{formatCurrency(currentBurden)}/mo</span>
            </div>

            {/* Simple bar chart */}
            <div className="flex items-end gap-1" style={{ height: 100 }}>
              {burdenTimeline.map((point, i) => {
                const height = maxBurden > 0 ? (point.amount / maxBurden) * 100 : 0
                return (
                  <div
                    key={i}
                    className="flex-1 rounded-t-md transition-all duration-500"
                    style={{
                      height: `${Math.max(height, 2)}%`,
                      backgroundColor: i === 0 ? '#3B82F6' : '#3B82F630',
                    }}
                  />
                )
              })}
            </div>
            <div className="flex gap-1 mt-1.5">
              {burdenTimeline.map((point, i) => (
                <div key={i} className="flex-1 text-center">
                  <span className="text-[9px] text-muted">{point.label}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Loan Cost Ranking */}
        {costRanking.length > 0 && (
          <div className="bg-card rounded-2xl border border-themed p-4 transition-colors">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-8 h-8 rounded-[11px] bg-red-500/10 flex items-center justify-center">
                <AlertTriangle className="w-4 h-4 text-red-500" />
              </div>
              <div>
                <h3 className="font-bold text-primary text-[15px] tracking-tight">Most Expensive Loans</h3>
                <p className="text-[11px] text-muted">Ranked by total interest cost</p>
              </div>
            </div>

            <div className="space-y-2.5">
              {costRanking.map(({ loan, totalInterest, costRatio }, i) => {
                const color = loan.color || DEFAULT_COLOR
                const maxInterest = costRanking[0].totalInterest
                const barWidth = maxInterest > 0 ? (totalInterest / maxInterest) * 100 : 0

                return (
                  <button
                    key={loan.id}
                    onClick={() => navigate(`/loan/${loan.id}`)}
                    className="w-full text-left group"
                  >
                    <div className="flex items-center gap-3 mb-1.5">
                      <span className="text-[12px] font-bold text-muted w-5">{i + 1}</span>
                      <div
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-bold text-white"
                        style={{ backgroundColor: color }}
                      >
                        {loan.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-semibold text-primary tracking-tight truncate group-hover:opacity-70 transition-opacity">
                          {loan.name}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-[13px] font-bold text-red-500 tracking-tight">{formatCurrency(totalInterest)}</p>
                        <p className="text-[10px] text-muted">{Math.round(costRatio * 100)}% of principal</p>
                      </div>
                    </div>
                    <div className="ml-8 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: `${color}12` }}>
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${barWidth}%`, backgroundColor: color }}
                      />
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
