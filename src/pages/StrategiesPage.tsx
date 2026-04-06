import { useState, useMemo } from 'react'
import { TrendingDown, Zap, Snowflake, Clock } from 'lucide-react'
import { useLoanStore } from '../features/loans/loanStore'
import { formatCurrency } from '../features/loans/loanUtils'
import { simulateStrategy } from '../features/strategies/strategyUtils'
import { BRAND_GRADIENT } from '../constants/styles'
import type { StrategyResult } from '../features/strategies/strategyUtils'

type Strategy = 'current' | 'snowball' | 'avalanche'

const STRATEGY_META: Record<Strategy, { label: string; desc: string; color: string; icon: typeof Clock }> = {
  current: { label: 'Current', desc: 'Pay each loan as scheduled', color: '#6E6E73', icon: Clock },
  snowball: { label: 'Snowball', desc: 'Pay smallest balance first', color: '#3B82F6', icon: Snowflake },
  avalanche: { label: 'Avalanche', desc: 'Pay highest interest first', color: '#EF4444', icon: Zap },
}

export default function StrategiesPage() {
  const { loans } = useLoanStore()
  const [extra, setExtra] = useState(0)

  const results = useMemo(() => {
    const strategies: Strategy[] = ['current', 'snowball', 'avalanche']
    return strategies.reduce((acc, s) => {
      acc[s] = simulateStrategy(loans, s, s === 'current' ? 0 : extra)
      return acc
    }, {} as Record<Strategy, StrategyResult>)
  }, [loans, extra])

  const current = results.current
  const best: Strategy = results.avalanche.totalInterest <= results.snowball.totalInterest ? 'avalanche' : 'snowball'

  return (
    <div className="min-h-screen bg-page transition-colors duration-300">
      <div style={{ background: BRAND_GRADIENT }}>
        <div className="max-w-2xl mx-auto px-4 pt-5 pb-5">
          <div className="mb-4">
            <h1 className="text-[22px] font-bold text-white tracking-tight leading-tight">Payment Strategies</h1>
            <p className="text-[12px] text-white/55 font-medium">Compare payoff methods</p>
          </div>

          {/* Extra payment input */}
          <div className="rounded-2xl bg-white/[0.13] backdrop-blur-sm border border-white/[0.12] p-4">
            <label className="block text-[11px] font-semibold text-white/60 uppercase tracking-wider mb-1.5">
              Extra monthly payment
            </label>
            <div className="flex items-center gap-2">
              <span className="text-white/50 text-[14px] font-semibold">+</span>
              <input
                type="number"
                value={extra || ''}
                onChange={(e) => setExtra(Math.max(0, Number(e.target.value) || 0))}
                placeholder="0"
                className="flex-1 bg-white/10 border border-white/10 rounded-xl px-3 py-2.5 text-[15px] font-semibold text-white placeholder-white/30 outline-none focus:border-white/30 transition-colors"
              />
              <span className="text-white/40 text-[13px]">per month</span>
            </div>
            <p className="text-[11px] text-white/40 mt-1.5">
              Amount beyond your regular payments to accelerate payoff
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 pt-4 pb-28 space-y-3">
        {/* Strategy cards */}
        {(['current', 'snowball', 'avalanche'] as Strategy[]).map((strategy) => {
          const meta = STRATEGY_META[strategy]
          const result = results[strategy]
          const saving = current.totalInterest - result.totalInterest
          const monthsSaved = current.totalMonths - result.totalMonths
          const isBest = strategy === best
          const Icon = meta.icon

          return (
            <div
              key={strategy}
              className={`bg-card rounded-2xl border p-4 transition-all ${
                isBest ? 'border-emerald-500/30 ring-1 ring-emerald-500/20' : 'border-themed'
              }`}
            >
              <div className="flex items-center gap-2.5 mb-3">
                <div
                  className="w-10 h-10 rounded-[13px] flex items-center justify-center"
                  style={{ backgroundColor: `${meta.color}12` }}
                >
                  <Icon className="w-4.5 h-4.5" style={{ color: meta.color }} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-[16px] font-bold text-primary tracking-tight">{meta.label}</h3>
                    {isBest && (
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500">
                        Best
                      </span>
                    )}
                  </div>
                  <p className="text-[12px] text-muted">{meta.desc}</p>
                </div>
              </div>

              {/* Stats grid */}
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-subtle rounded-xl p-2.5">
                  <p className="text-[10px] font-semibold text-muted uppercase tracking-wider">Months</p>
                  <p className="text-[16px] font-bold text-primary tracking-tight">{result.totalMonths}</p>
                  {monthsSaved > 0 && strategy !== 'current' && (
                    <p className="text-[10px] font-semibold text-emerald-500">-{monthsSaved} months</p>
                  )}
                </div>
                <div className="bg-subtle rounded-xl p-2.5">
                  <p className="text-[10px] font-semibold text-muted uppercase tracking-wider">Interest</p>
                  <p className="text-[14px] font-bold text-primary tracking-tight">{formatCurrency(result.totalInterest)}</p>
                  {saving > 0.5 && strategy !== 'current' && (
                    <p className="text-[10px] font-semibold text-emerald-500">Save {formatCurrency(saving)}</p>
                  )}
                </div>
                <div className="bg-subtle rounded-xl p-2.5">
                  <p className="text-[10px] font-semibold text-muted uppercase tracking-wider">Total</p>
                  <p className="text-[14px] font-bold text-primary tracking-tight">{formatCurrency(result.totalPaid)}</p>
                </div>
              </div>

              {/* Payoff order */}
              {result.payoffOrder.length > 0 && (
                <div className="mt-3 pt-3 border-t border-divider">
                  <p className="text-[10px] font-semibold text-muted uppercase tracking-wider mb-1.5">Payoff order</p>
                  <div className="flex flex-wrap gap-1.5">
                    {result.payoffOrder.map((p, i) => (
                      <span
                        key={i}
                        className="text-[11px] font-medium text-secondary bg-subtle rounded-lg px-2 py-1"
                      >
                        {i + 1}. {p.loanName} <span className="text-muted">({p.paidOffMonth}mo)</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )
        })}

        {/* Summary callout */}
        {current.totalMonths > 0 && (
          <div className="bg-emerald-500/10 rounded-2xl border border-emerald-500/20 p-4 text-center">
            <TrendingDown className="w-5 h-5 text-emerald-500 mx-auto mb-1" />
            <p className="text-[14px] font-bold text-emerald-600 dark:text-emerald-400">
              {STRATEGY_META[best].label} saves you {formatCurrency(current.totalInterest - results[best].totalInterest)}
            </p>
            <p className="text-[12px] text-emerald-600/70 dark:text-emerald-400/70 mt-0.5">
              and {current.totalMonths - results[best].totalMonths} months faster
              {extra > 0 ? ` with ${formatCurrency(extra)}/mo extra` : ''}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
