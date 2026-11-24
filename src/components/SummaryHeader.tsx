import { CreditCard, CalendarCheck, TrendingUp, Wallet, CalendarClock } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { UpcomingPayments } from '../features/loans/loanUtils'
import type { FinancialOverview, HealthScore } from '../features/finance/financeTypes'
import CurrencyAmount from './CurrencyAmount'
import HealthScoreCard from '../features/finance/HealthScoreCard'
import ProgressBar from './ProgressBar'

type Props = {
  totalDebt: number
  totalMonthly: number
  loanCount: number
  totalInterest: number
  debtFreeDate: Date | null
  debtToIncome: number
  hasIncome: boolean
  overview: FinancialOverview
  health: HealthScore
  /** Share of the total cost of active loans already paid, 0–1. */
  paidRatio: number
  upcoming?: UpcomingPayments | null
}

function formatDateRange(from: Date, to: Date): string {
  const sameDay = from.getTime() === to.getTime()
  const fromLabel = from.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  if (sameDay) return fromLabel
  const sameMonth = from.getMonth() === to.getMonth() && from.getFullYear() === to.getFullYear()
  const toLabel = to.toLocaleDateString('en-US', sameMonth ? { day: 'numeric' } : { month: 'short', day: 'numeric' })
  return `${fromLabel} – ${toLabel}`
}

/** Flat colour-block stat: a soft tint carries the category, no outline. */
function StatTile({ icon: Icon, label, children, tint, wide = false }: { icon: LucideIcon; label: string; children: React.ReactNode; tint: string; wide?: boolean }) {
  return (
    <div className={`rounded-2xl p-4 ${wide ? 'col-span-2' : ''}`} style={{ backgroundColor: tint }}>
      <div className="flex items-center gap-1.5 mb-2.5">
        <Icon className="w-4 h-4 text-secondary" strokeWidth={2.25} />
        <span className="text-[13px] font-bold text-secondary">{label}</span>
      </div>
      <p className="text-[20px] font-extrabold font-display tabular-nums text-primary tracking-tight leading-tight">{children}</p>
    </div>
  )
}

/**
 * The dashboard's money summary: what's left to pay (with a payoff bar),
 * the next due date, a few key stats, and the financial health score.
 */
export default function SummaryHeader({
  totalDebt,
  totalMonthly,
  loanCount,
  totalInterest,
  debtFreeDate,
  debtToIncome,
  hasIncome,
  overview,
  health,
  paidRatio,
  upcoming = null,
}: Props) {
  const dtiPercent = Math.round(debtToIncome * 100)
  const dtiColor =
    dtiPercent > 50 ? 'text-red-600 dark:text-red-400' : dtiPercent > 30 ? 'text-amber-700 dark:text-amber-400' : 'text-emerald-700 dark:text-emerald-400'
  const paidPercent = Math.round(Math.min(1, Math.max(0, paidRatio)) * 100)

  return (
    <section aria-label="Summary" className="space-y-3">
      {/* Left to pay */}
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

        {upcoming && (
          <div className="mt-3.5 pt-3.5 border-t border-divider flex items-center gap-2.5">
            <CalendarClock className="w-4 h-4 text-brand shrink-0" strokeWidth={2.5} />
            <p className="text-[13px] text-secondary">
              <span className="font-bold text-primary">Next due {formatDateRange(upcoming.from, upcoming.to)}:</span>{' '}
              <CurrencyAmount value={upcoming.amount} /> for {upcoming.count} {upcoming.count === 1 ? 'payment' : 'payments'}
            </p>
          </div>
        )}
      </div>

      {/* Key stats */}
      <div className="grid grid-cols-2 gap-3">
        <StatTile icon={CreditCard} label="Monthly" tint="var(--tint-teal)">
          <CurrencyAmount value={totalMonthly} />
        </StatTile>
        <StatTile icon={CalendarCheck} label="Debt-free" tint="var(--tint-amber)">
          {debtFreeDate ? debtFreeDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : 'Now'}
        </StatTile>
        {loanCount > 0 && (
          <StatTile icon={TrendingUp} label="Total interest" tint="var(--tint-red)" wide={!hasIncome}>
            <CurrencyAmount value={totalInterest} />
          </StatTile>
        )}
        {loanCount > 0 && hasIncome && (
          <StatTile icon={Wallet} label="Of your income" tint="var(--tint-neutral)">
            <span className={dtiColor}>{dtiPercent}%</span>
          </StatTile>
        )}
      </div>

      <HealthScoreCard overview={overview} health={health} />
    </section>
  )
}
