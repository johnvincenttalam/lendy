import { useState, useMemo } from 'react'
import { debtPayoffTimeline, formatCurrency } from '../features/loans/loanUtils'
import type { Loan } from '../features/loans/loanTypes'

const CHART_W = 600
const CHART_H = 260
const PAD = { top: 20, right: 16, bottom: 36, left: 60 }
const PLOT_W = CHART_W - PAD.left - PAD.right
const PLOT_H = CHART_H - PAD.top - PAD.bottom

export default function DebtChart({ loans }: { loans: Loan[] }) {
  const timeline = useMemo(() => debtPayoffTimeline(loans), [loans])
  const [hoverIdx, setHoverIdx] = useState<number | null>(null)

  if (timeline.length < 2) return null

  const maxVal = Math.max(...timeline.map((p) => p.balance))
  const minVal = 0

  const scaleX = (i: number) => PAD.left + (i / (timeline.length - 1)) * PLOT_W
  const scaleY = (v: number) => PAD.top + PLOT_H - ((v - minVal) / (maxVal - minVal || 1)) * PLOT_H

  // Build line path
  const linePath = timeline
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${scaleX(i).toFixed(1)} ${scaleY(p.balance).toFixed(1)}`)
    .join(' ')

  // Build area path
  const areaPath =
    linePath +
    ` L ${scaleX(timeline.length - 1).toFixed(1)} ${scaleY(0).toFixed(1)}` +
    ` L ${scaleX(0).toFixed(1)} ${scaleY(0).toFixed(1)} Z`

  // Y-axis ticks (4 ticks)
  const yTicks = [0, 1, 2, 3].map((i) => {
    const val = minVal + ((maxVal - minVal) * i) / 3
    return { val, y: scaleY(val) }
  })

  // X-axis labels (pick ~5 evenly spaced)
  const labelCount = Math.min(5, timeline.length)
  const xLabels = Array.from({ length: labelCount }, (_, i) => {
    const idx = Math.round((i / (labelCount - 1)) * (timeline.length - 1))
    const d = timeline[idx].date
    return {
      idx,
      x: scaleX(idx),
      label: d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
    }
  })

  const handleHover = (e: React.MouseEvent<SVGSVGElement> | React.TouchEvent<SVGSVGElement>) => {
    const svg = e.currentTarget
    const rect = svg.getBoundingClientRect()
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
    const relX = ((clientX - rect.left) / rect.width) * CHART_W
    const idx = Math.round(((relX - PAD.left) / PLOT_W) * (timeline.length - 1))
    setHoverIdx(Math.max(0, Math.min(timeline.length - 1, idx)))
  }

  const hoverPoint = hoverIdx !== null ? timeline[hoverIdx] : null

  return (
    <div className="bg-card rounded-2xl border border-themed p-4">
      <h3 className="text-[11px] font-bold text-muted uppercase tracking-widest mb-3">
        Debt Payoff Timeline
      </h3>

      {/* Tooltip */}
      {hoverPoint && hoverIdx !== null && (
        <div className="flex items-center justify-between mb-2 px-1">
          <span className="text-[12px] text-muted">
            {hoverPoint.date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </span>
          <span className="text-[14px] font-bold text-brand tracking-tight">{formatCurrency(hoverPoint.balance)}</span>
        </div>
      )}

      <svg
        viewBox={`0 0 ${CHART_W} ${CHART_H}`}
        className="w-full h-auto"
        onMouseMove={handleHover}
        onTouchMove={handleHover}
        onMouseLeave={() => setHoverIdx(null)}
        onTouchEnd={() => setHoverIdx(null)}
      >
        <defs>
          <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-brand)" stopOpacity="0.25" />
            <stop offset="100%" stopColor="var(--color-brand)" stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {/* Grid lines */}
        {yTicks.map(({ y }, i) => (
          <line key={i} x1={PAD.left} y1={y} x2={CHART_W - PAD.right} y2={y} stroke="var(--color-border)" strokeWidth="1" />
        ))}

        {/* Y labels */}
        {yTicks.map(({ val, y }, i) => (
          <text key={i} x={PAD.left - 8} y={y + 4} textAnchor="end" fontSize="10" fill="var(--color-text-muted)" fontFamily="Outfit">
            {val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val.toFixed(0)}
          </text>
        ))}

        {/* X labels */}
        {xLabels.map(({ x, label }, i) => (
          <text key={i} x={x} y={CHART_H - 8} textAnchor="middle" fontSize="10" fill="var(--color-text-muted)" fontFamily="Outfit">
            {label}
          </text>
        ))}

        {/* Area */}
        <path d={areaPath} fill="url(#areaGrad)" />

        {/* Line */}
        <path d={linePath} fill="none" stroke="var(--color-brand)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

        {/* Hover indicator */}
        {hoverIdx !== null && hoverPoint && (
          <>
            <line
              x1={scaleX(hoverIdx)} y1={PAD.top}
              x2={scaleX(hoverIdx)} y2={PAD.top + PLOT_H}
              stroke="var(--color-text-muted)" strokeWidth="1" strokeDasharray="4 3"
            />
            <circle cx={scaleX(hoverIdx)} cy={scaleY(hoverPoint.balance)} r="5" fill="var(--color-brand)" stroke="var(--color-card)" strokeWidth="2.5" />
          </>
        )}
      </svg>
    </div>
  )
}
