import { useState } from 'react'
import { Activity, ChevronDown } from 'lucide-react'
import type { FinancialOverview, HealthScore, ScoreBandName, SuppressedReason } from './financeTypes'
import CurrencyAmount from '../../components/CurrencyAmount'

type Props = {
  overview: FinancialOverview
  health: HealthScore
}

const SUPPRESSED_PROMPTS: Record<SuppressedReason, string> = {
  'no-income': 'Add your monthly income in Settings to see your health score.',
  'no-data': 'Add a loan, a bill or a savings goal to see your score.',
}

// Matches the red-300 / amber-300 / emerald-300 "how bad is it" triad the DTI
// tile already uses just below on this same header (SummaryHeader.tsx). No
// new color is introduced. text-brand is deliberately avoided here: commit
// 55c863f retired that green from calendar status chips because it reads a
// shade away from the emerald used for "Paid" — green now means settled and
// nothing else, so it can't also mean "needs attention". stable and healthy
// use distinct emerald shades so the band label isn't the only signal.
const BAND_TEXT: Record<ScoreBandName, string> = {
  'at-risk': 'text-red-300',
  'needs-attention': 'text-amber-300',
  stable: 'text-emerald-400',
  healthy: 'text-emerald-300',
}

export default function HealthScoreCard({ overview, health }: Props) {
  const [expanded, setExpanded] = useState(false)

  if (health.suppressed) {
    return (
      <div className="mb-4 rounded-2xl bg-white/[0.13] backdrop-blur-sm border border-white/[0.12] p-4">
        <div className="flex items-center gap-2 mb-1">
          <Activity className="w-4 h-4 text-white/70" />
          <span className="text-[11px] font-semibold text-white/60 uppercase tracking-wider">Financial Health</span>
        </div>
        <p className="text-[13px] text-white/70">
          {SUPPRESSED_PROMPTS[health.suppressedReason ?? 'no-income']}
        </p>
      </div>
    )
  }

  return (
    <div className="mb-4 rounded-2xl bg-white/[0.13] backdrop-blur-sm border border-white/[0.12] overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-4 text-left"
        aria-expanded={expanded}
      >
        <div className="flex items-center gap-2 mb-2">
          <Activity className="w-4 h-4 text-white/70" />
          <span className="text-[11px] font-semibold text-white/60 uppercase tracking-wider">Financial Health</span>
          <ChevronDown className={`w-4 h-4 text-white/50 ml-auto transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </div>

        <div className="flex items-baseline gap-2">
          <span className="text-[34px] font-bold font-mono text-white tracking-tight leading-none">{health.score}</span>
          <span className="text-[13px] text-white/50 font-mono">/100</span>
          <span className={`text-[13px] font-bold ml-auto ${BAND_TEXT[health.band]}`}>{health.label}</span>
        </div>

        <p className="text-[12px] text-white/60 mt-2.5">
          Committed <CurrencyAmount value={overview.totalCommitments} />
          {' · '}
          {overview.uncommitted < 0 ? (
            <span className="text-red-300 font-semibold">
              Over-committed <CurrencyAmount value={Math.abs(overview.uncommitted)} />
            </span>
          ) : (
            <>Uncommitted <CurrencyAmount value={overview.uncommitted} /></>
          )}
        </p>
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-2 border-t border-white/[0.08] pt-3">
          {health.metrics.map((metric) => (
            <div key={metric.key} className="flex items-baseline gap-2">
              <div className="flex-1 min-w-0">
                <p className={`text-[12px] font-semibold ${metric.included ? 'text-white/85' : 'text-white/40'}`}>
                  {metric.label}
                </p>
                <p className={`text-[11px] ${metric.included ? 'text-white/50' : 'text-white/30'}`}>
                  {metric.included ? metric.detail : metric.omissionReason}
                </p>
              </div>
              <span className={`text-[13px] font-bold font-mono ${metric.included ? 'text-white' : 'text-white/30'}`}>
                {metric.included ? `${metric.score}` : '—'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
