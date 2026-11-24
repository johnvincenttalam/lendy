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

// Band colours reuse the app's status triad (red / amber / emerald), each
// darkened for the light theme and lifted for dark mode. Two emerald
// shades keep stable and healthy distinct so the label isn't the only cue.
const BAND_TEXT: Record<ScoreBandName, string> = {
  'at-risk': 'text-red-600 dark:text-red-400',
  'needs-attention': 'text-amber-700 dark:text-amber-400',
  stable: 'text-emerald-600 dark:text-emerald-400',
  healthy: 'text-emerald-700 dark:text-emerald-300',
}

export default function HealthScoreCard({ overview, health }: Props) {
  const [expanded, setExpanded] = useState(false)

  if (health.suppressed) {
    return (
      <div className="rounded-2xl bg-card border border-themed p-4">
        <div className="flex items-center gap-2 mb-1">
          <Activity className="w-4 h-4 text-secondary" />
          <span className="text-[11px] font-semibold text-muted">Financial Health</span>
        </div>
        <p className="text-[13px] text-secondary">
          {SUPPRESSED_PROMPTS[health.suppressedReason ?? 'no-income']}
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-2xl bg-card border border-themed overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-4 text-left"
        aria-expanded={expanded}
      >
        <div className="flex items-center gap-2 mb-2">
          <Activity className="w-4 h-4 text-secondary" />
          <span className="text-[11px] font-semibold text-muted">Financial Health</span>
          <ChevronDown className={`w-4 h-4 text-muted ml-auto transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </div>

        <div className="flex items-baseline gap-2">
          <span className="text-[38px] font-extrabold font-display tabular-nums text-primary tracking-tight leading-none">{health.score}</span>
          <span className="text-[13px] text-muted font-display tabular-nums">/100</span>
          <span className={`text-[13px] font-bold ml-auto ${BAND_TEXT[health.band]}`}>{health.label}</span>
        </div>

        <p className="text-[12px] text-muted mt-2.5">
          Committed <CurrencyAmount value={overview.totalCommitments} />
          {' · '}
          {overview.uncommitted < 0 ? (
            <span className="text-red-600 dark:text-red-400 font-semibold">
              Over-committed <CurrencyAmount value={Math.abs(overview.uncommitted)} />
            </span>
          ) : (
            <>Uncommitted <CurrencyAmount value={overview.uncommitted} /></>
          )}
        </p>
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-2 border-t border-divider pt-3">
          {health.metrics.map((metric) => (
            <div key={metric.key} className="flex items-baseline gap-2">
              <div className="flex-1 min-w-0">
                <p className={`text-[12px] font-semibold ${metric.included ? 'text-secondary' : 'text-muted'}`}>
                  {metric.label}
                </p>
                <p className={`text-[11px] ${metric.included ? 'text-muted' : 'text-muted'}`}>
                  {metric.included ? metric.detail : metric.omissionReason}
                </p>
              </div>
              <span className={`text-[13px] font-bold font-display tabular-nums ${metric.included ? 'text-primary' : 'text-muted'}`}>
                {metric.included ? `${metric.score}` : '—'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
