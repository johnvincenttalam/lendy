import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Flame, Target, TrendingDown, DollarSign, AlertTriangle, BarChart3,
  CheckCircle2, Wallet, Layers, Zap,
} from 'lucide-react'
import { useLoanStore } from '../features/loans/loanStore'
import EmptyState from '../components/EmptyState'
import {
  formatCurrency, isFullyPaid, totalInterestOverLife, totalCostOfLoan,
  interestPaidSoFar, remainingBalance, debtFreeDate, monthsLeft,
  interestRemaining, debtToIncomeRatio,
} from '../features/loans/loanUtils'
import type { Loan, PaymentRecord } from '../features/loans/loanTypes'
import { DEFAULT_COLOR, LOAN_COLORS, LOAN_TAGS } from '../features/loans/loanTypes'
import { BRAND_GRADIENT } from '../constants/styles'

function computePaymentStreak(loans: Loan[]): number {
  // Total payments made across all loans (lifetime, including archived/paid-off)
  return loans.reduce((sum, l) => sum + l.monthsPaid, 0)
}

function computeDebtBurdenTimeline(loans: Loan[]): Array<{ label: string; amount: number }> {
  const active = loans.filter((l) => !l.archived && !isFullyPaid(l))
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
    .filter((l) => !l.archived && l.interestRate > 0)
    .map((loan) => ({
      loan,
      totalInterest: totalInterestOverLife(loan),
      costRatio: totalInterestOverLife(loan) / loan.totalAmount,
    }))
    .sort((a, b) => b.totalInterest - a.totalInterest)
}

function computeOnTimeStats(payments: PaymentRecord[]): { onTimeRate: number; avgDaysDelta: number; onTimeCount: number; total: number } {
  let onTimeCount = 0
  let totalDeltaDays = 0
  for (const p of payments) {
    const paidDate = new Date(p.paidAt)
    paidDate.setHours(0, 0, 0, 0)
    const dueDate = new Date(p.dueDate)
    dueDate.setHours(0, 0, 0, 0)
    const deltaDays = Math.round((paidDate.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24))
    if (deltaDays <= 0) onTimeCount++
    totalDeltaDays += deltaDays
  }
  return {
    onTimeRate: payments.length > 0 ? Math.round((onTimeCount / payments.length) * 100) : 0,
    avgDaysDelta: payments.length > 0 ? Math.round(totalDeltaDays / payments.length) : 0,
    onTimeCount,
    total: payments.length,
  }
}

function computePayoffPriority(activeLoans: Loan[]): Array<{ loan: Loan; monthsLeft: number; remainingInterest: number }> {
  return activeLoans
    .filter((l) => l.interestRate > 0)
    .map((loan) => ({
      loan,
      monthsLeft: monthsLeft(loan),
      remainingInterest: interestRemaining(loan),
    }))
    .sort((a, b) => b.loan.interestRate - a.loan.interestRate)
}

function tagColor(tag: string): string {
  const index = LOAN_TAGS.indexOf(tag as (typeof LOAN_TAGS)[number])
  return index >= 0 ? LOAN_COLORS[index % LOAN_COLORS.length] : DEFAULT_COLOR
}

function computeCategoryBreakdown(activeLoans: Loan[]): Array<{ tag: string; remaining: number; monthly: number; count: number }> {
  const map = new Map<string, { tag: string; remaining: number; monthly: number; count: number }>()
  for (const loan of activeLoans) {
    const tag = loan.tag || 'Other'
    const entry = map.get(tag) ?? { tag, remaining: 0, monthly: 0, count: 0 }
    entry.remaining += remainingBalance(loan)
    entry.monthly += loan.monthlyPayment
    entry.count += 1
    map.set(tag, entry)
  }
  return [...map.values()].sort((a, b) => b.remaining - a.remaining)
}

export default function AnalyticsPage() {
  const navigate = useNavigate()
  const { loans, payments, monthlyIncome } = useLoanStore()

  const activeLoans = useMemo(() => loans.filter((l) => !l.archived && !isFullyPaid(l)), [loans])

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

  // 6. On-time payment rate
  const onTimeStats = useMemo(() => computeOnTimeStats(payments), [payments])

  // 7. Debt-to-income health
  const dtiRatio = useMemo(() => debtToIncomeRatio(activeLoans, monthlyIncome), [activeLoans, monthlyIncome])
  const dtiPercent = Math.round(dtiRatio * 100)
  const dtiMonthly = useMemo(() => activeLoans.reduce((sum, l) => sum + l.monthlyPayment, 0), [activeLoans])
  const dtiBand = dtiPercent > 50 ? 'high' : dtiPercent > 30 ? 'moderate' : 'healthy'

  // 8. Payoff priority advisor
  const payoffPriority = useMemo(() => computePayoffPriority(activeLoans), [activeLoans])

  // 9. Debt by category
  const categoryBreakdown = useMemo(() => computeCategoryBreakdown(activeLoans), [activeLoans])
  const categoryTotal = categoryBreakdown.reduce((sum, c) => sum + c.remaining, 0)

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
                <p className="text-[28px] font-bold font-mono text-white tracking-tight leading-tight">
                  {streak} <span className="text-[14px] font-sans font-semibold text-white/60">payments made</span>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 pt-4 pb-28 space-y-4">
        {/* Payment reliability */}
        {onTimeStats.total > 0 && (
          <div className="bg-card rounded-2xl border border-themed p-4 transition-colors">
            <div className="flex items-center gap-2.5 mb-4">
              <div className={`w-8 h-8 rounded-[11px] flex items-center justify-center ${
                onTimeStats.onTimeRate >= 90 ? 'bg-emerald-500/10' : onTimeStats.onTimeRate >= 70 ? 'bg-amber-500/10' : 'bg-red-500/10'
              }`}>
                <CheckCircle2 className={`w-4 h-4 ${
                  onTimeStats.onTimeRate >= 90 ? 'text-emerald-500' : onTimeStats.onTimeRate >= 70 ? 'text-amber-500' : 'text-red-500'
                }`} />
              </div>
              <h3 className="font-bold text-primary text-[15px] tracking-tight">Payment Reliability</h3>
            </div>
            <div className="flex items-center gap-4">
              <p className={`text-[36px] font-bold font-mono tracking-tighter leading-none ${
                onTimeStats.onTimeRate >= 90 ? 'text-emerald-500' : onTimeStats.onTimeRate >= 70 ? 'text-amber-500' : 'text-red-500'
              }`}>
                {onTimeStats.onTimeRate}%
              </p>
              <div className="flex-1">
                <p className="text-[13px] text-secondary">
                  {onTimeStats.onTimeCount} of {onTimeStats.total} payments made on or before the due date
                </p>
                <p className="text-[12px] text-muted mt-0.5">
                  {onTimeStats.avgDaysDelta === 0
                    ? 'Right on schedule, on average'
                    : onTimeStats.avgDaysDelta < 0
                      ? `${Math.abs(onTimeStats.avgDaysDelta)} days early, on average`
                      : `${onTimeStats.avgDaysDelta} days late, on average`}
                </p>
              </div>
            </div>
          </div>
        )}

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
                <p className="text-[36px] font-bold font-mono text-primary tracking-tighter leading-none">
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
                  <p className="text-[14px] font-bold font-mono text-primary tracking-tight">{formatCurrency(totalRemainingDebt)}</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-4">
              <p className="text-[20px] font-bold text-emerald-500 tracking-tight">You're debt-free!</p>
            </div>
          )}
        </div>

        {/* Debt-to-income health */}
        <div className="bg-card rounded-2xl border border-themed p-4 transition-colors">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="w-8 h-8 rounded-[11px] bg-violet-500/10 flex items-center justify-center">
              <Wallet className="w-4 h-4 text-violet-500" />
            </div>
            <h3 className="font-bold text-primary text-[15px] tracking-tight">Debt-to-Income</h3>
          </div>
          {monthlyIncome > 0 ? (
            <div className="space-y-3">
              <div className="flex items-end justify-between">
                <p className={`text-[36px] font-bold font-mono tracking-tighter leading-none ${
                  dtiBand === 'healthy' ? 'text-emerald-500' : dtiBand === 'moderate' ? 'text-amber-500' : 'text-red-500'
                }`}>
                  {dtiPercent}%
                </p>
                <p className="text-[12px] text-muted mb-1">of income goes to debt</p>
              </div>
              <div className="w-full h-2 rounded-full bg-subtle overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${
                    dtiBand === 'healthy' ? 'bg-emerald-500' : dtiBand === 'moderate' ? 'bg-amber-500' : 'bg-red-500'
                  }`}
                  style={{ width: `${Math.min(100, dtiPercent)}%` }}
                />
              </div>
              <p className="text-[12px] text-secondary">
                {dtiBand === 'healthy' && 'Healthy — your debt load is well within a comfortable range.'}
                {dtiBand === 'moderate' && 'Moderate — worth keeping an eye on before taking on more debt.'}
                {dtiBand === 'high' && 'High — a large share of your income is going to debt payments.'}
              </p>
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="bg-subtle rounded-xl p-3">
                  <p className="text-[10px] font-semibold text-muted uppercase tracking-widest mb-1">Monthly Income</p>
                  <p className="text-[14px] font-bold font-mono text-primary tracking-tight">{formatCurrency(monthlyIncome)}</p>
                </div>
                <div className="bg-subtle rounded-xl p-3">
                  <p className="text-[10px] font-semibold text-muted uppercase tracking-widest mb-1">Monthly Debt</p>
                  <p className="text-[14px] font-bold font-mono text-primary tracking-tight">{formatCurrency(dtiMonthly)}</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-3">
              <p className="text-[13px] text-muted mb-3">Add your monthly income to see how much of it goes to debt</p>
              <button
                onClick={() => navigate('/settings')}
                className="bg-brand text-on-brand text-[13px] font-semibold px-4 py-2 rounded-xl hover:opacity-90 transition-opacity active:scale-95"
              >
                Add income in Settings
              </button>
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
                  <p className="text-[14px] font-bold font-mono text-emerald-500 tracking-tight">{formatCurrency(totalPrincipalPaid)}</p>
                </div>
                <div className="bg-subtle rounded-xl p-3">
                  <p className="text-[10px] font-semibold text-muted uppercase tracking-widest mb-1">Interest Paid</p>
                  <p className="text-[14px] font-bold font-mono text-red-500 tracking-tight">{formatCurrency(totalInterestPaid)}</p>
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
                <span className="text-[13px] font-bold font-mono text-primary">{formatCurrency(lifetimePrincipal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[13px] text-secondary">Total Interest</span>
                <span className="text-[13px] font-bold font-mono text-red-500">{formatCurrency(lifetimeInterest)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[13px] text-secondary">Total Cost</span>
                <span className="text-[13px] font-bold font-mono text-primary">{formatCurrency(lifetimeTotal)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Debt by category */}
        {categoryBreakdown.length > 0 && (
          <div className="bg-card rounded-2xl border border-themed p-4 transition-colors">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-8 h-8 rounded-[11px] bg-amber-500/10 flex items-center justify-center">
                <Layers className="w-4 h-4 text-amber-500" />
              </div>
              <div>
                <h3 className="font-bold text-primary text-[15px] tracking-tight">Debt by Category</h3>
                <p className="text-[11px] text-muted">Where your active debt is concentrated</p>
              </div>
            </div>

            {/* Stacked bar */}
            <div className="w-full h-3 rounded-full overflow-hidden flex mb-3">
              {categoryBreakdown.map((c) => (
                <div
                  key={c.tag}
                  className="h-full transition-all duration-700"
                  style={{ width: `${categoryTotal > 0 ? (c.remaining / categoryTotal) * 100 : 0}%`, backgroundColor: tagColor(c.tag) }}
                />
              ))}
            </div>

            <div className="space-y-2.5">
              {categoryBreakdown.map((c) => (
                <div key={c.tag} className="flex items-center gap-3">
                  <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: tagColor(c.tag) }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold text-primary tracking-tight">
                      {c.tag} <span className="text-muted font-normal">· {c.count} {c.count === 1 ? 'loan' : 'loans'}</span>
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[13px] font-bold font-mono text-primary tracking-tight">{formatCurrency(c.remaining)}</p>
                    <p className="text-[10px] text-muted">{categoryTotal > 0 ? Math.round((c.remaining / categoryTotal) * 100) : 0}%</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

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
              <span className="text-[14px] font-bold font-mono text-primary tracking-tight">{formatCurrency(currentBurden)}/mo</span>
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

        {/* Payoff priority advisor */}
        {payoffPriority.length > 1 && (
          <div className="bg-card rounded-2xl border border-themed p-4 transition-colors">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-8 h-8 rounded-[11px] bg-cyan-500/10 flex items-center justify-center">
                <Zap className="w-4 h-4 text-cyan-500" />
              </div>
              <div>
                <h3 className="font-bold text-primary text-[15px] tracking-tight">Payoff Priority</h3>
                <p className="text-[11px] text-muted">Which loan to attack first, by rate</p>
              </div>
            </div>

            <button
              onClick={() => navigate(`/loan/${payoffPriority[0].loan.id}`)}
              className="w-full text-left bg-cyan-500/[0.08] border border-cyan-500/20 rounded-xl p-3 mb-3 hover:opacity-80 transition-opacity"
            >
              <p className="text-[13px] text-secondary">
                Pay off <span className="font-bold text-primary">{payoffPriority[0].loan.name}</span> first — it carries the highest rate at{' '}
                <span className="font-bold text-primary">{payoffPriority[0].loan.interestRate}%/mo</span>, costing{' '}
                <span className="font-bold font-mono text-cyan-500">{formatCurrency(payoffPriority[0].remainingInterest)}</span> more in interest.
              </p>
            </button>

            <div className="space-y-2">
              {payoffPriority.map(({ loan, monthsLeft: left }, i) => (
                <button
                  key={loan.id}
                  onClick={() => navigate(`/loan/${loan.id}`)}
                  className="w-full flex items-center gap-3 group"
                >
                  <span className="text-[12px] font-bold text-muted w-5 text-left">{i + 1}</span>
                  <div className="flex-1 min-w-0 text-left">
                    <p className="text-[13px] font-semibold text-primary tracking-tight truncate group-hover:opacity-70 transition-opacity">
                      {loan.name}
                    </p>
                    <p className="text-[10px] text-muted">{left} {left === 1 ? 'month' : 'months'} left</p>
                  </div>
                  <span className="text-[13px] font-bold font-mono text-primary shrink-0">{loan.interestRate}%/mo</span>
                </button>
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
                        <p className="text-[13px] font-bold font-mono text-red-500 tracking-tight">{formatCurrency(totalInterest)}</p>
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
