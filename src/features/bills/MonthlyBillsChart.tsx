import { useMemo } from 'react'
import { BarChart3 } from 'lucide-react'
import type { Bill, BillPaymentRecord } from './billTypes'
import { buildMonthlyBillTotals } from './billChartUtils'
import CurrencyAmount from '../../components/CurrencyAmount'

const MONTHS_SHOWN = 6
const BRAND = '#3ECF8E'

type Props = {
  bills: Bill[]
  billPayments: BillPaymentRecord[]
}

/**
 * Bar chart of what was actually paid per month, so the user can see which
 * months ran expensive. Renders nothing until two months have finished — a
 * single completed month has nothing to be higher or lower than, and the card
 * would just be an empty state on a page that already has one.
 */
export default function MonthlyBillsChart({ bills, billPayments }: Props) {
  const months = useMemo(
    () => buildMonthlyBillTotals(bills, billPayments, MONTHS_SHOWN),
    [bills, billPayments],
  )

  // The current month is still accumulating, so it can't fairly be called the
  // cheapest — every comparison here runs over finished months only.
  const summary = useMemo(() => {
    const finished = months.filter((m) => !m.inProgress)
    if (finished.length < 2) return null

    let highest = finished[0]
    let lowest = finished[0]
    for (const month of finished) {
      if (month.total > highest.total) highest = month
      if (month.total < lowest.total) lowest = month
    }
    const average = finished.reduce((sum, m) => sum + m.total, 0) / finished.length
    return { highest, lowest, average, count: finished.length }
  }, [months])

  if (!summary) return null

  const peak = Math.max(...months.map((m) => m.total))
  const inProgress = months.find((m) => m.inProgress)

  return (
    <div className="bg-card rounded-2xl border border-themed p-4 mb-3 transition-colors">
      <div className="flex items-center gap-2.5 mb-4">
        <div className="w-8 h-8 rounded-[11px] bg-brand/10 flex items-center justify-center shrink-0">
          <BarChart3 className="w-4 h-4 text-brand" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-primary text-[15px] tracking-tight">Monthly Bills</h3>
          <p className="text-[11px] text-muted">What you actually paid each month</p>
        </div>
      </div>

      <div className="flex gap-2 mb-4">
        <div className="flex-1 rounded-xl bg-subtle p-2.5 min-w-0">
          <span className="text-[10px] font-semibold text-muted uppercase tracking-wider">Highest</span>
          <p className="text-[13px] font-bold text-primary tracking-tight truncate">
            {summary.highest.label}{' '}
            <span className="font-mono text-secondary">
              <CurrencyAmount value={summary.highest.total} />
            </span>
          </p>
        </div>
        <div className="flex-1 rounded-xl bg-subtle p-2.5 min-w-0">
          <span className="text-[10px] font-semibold text-muted uppercase tracking-wider">Lowest</span>
          <p className="text-[13px] font-bold text-primary tracking-tight truncate">
            {summary.lowest.label}{' '}
            <span className="font-mono text-secondary">
              <CurrencyAmount value={summary.lowest.total} />
            </span>
          </p>
        </div>
      </div>

      <div
        className="flex items-end gap-1"
        style={{ height: 100 }}
        role="img"
        aria-label={months
          .map((m) => `${m.label}: ${Math.round(m.total)}${m.inProgress ? ' so far' : ''}`)
          .join(', ')}
      >
        {months.map((month) => {
          const height = peak > 0 ? (month.total / peak) * 100 : 0
          const isPeak = !month.inProgress && month.total === summary.highest.total
          return (
            <div
              key={month.key}
              className="flex-1 rounded-t-md transition-all duration-500"
              style={{
                height: `${Math.max(height, 2)}%`,
                backgroundColor: month.inProgress ? `${BRAND}14` : isPeak ? BRAND : `${BRAND}30`,
                border: month.inProgress ? `1px dashed ${BRAND}66` : undefined,
              }}
            />
          )
        })}
      </div>
      <div className="flex gap-1 mt-1.5">
        {months.map((month) => (
          <div key={month.key} className="flex-1 text-center">
            <span className={`text-[9px] ${month.inProgress ? 'text-brand font-semibold' : 'text-muted'}`}>
              {month.label}
            </span>
          </div>
        ))}
      </div>

      <p className="text-[11px] text-muted mt-3">
        Avg <span className="font-mono font-semibold text-secondary"><CurrencyAmount value={summary.average} /></span>
        {' '}across {summary.count} finished {summary.count === 1 ? 'month' : 'months'}
        {inProgress && ` · ${inProgress.label} still in progress`}
      </p>
    </div>
  )
}
