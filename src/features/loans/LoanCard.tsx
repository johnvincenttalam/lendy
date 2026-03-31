import { useNavigate } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { DEFAULT_COLOR } from './loanTypes'
import type { Loan } from './loanTypes'
import {
  remainingBalance,
  monthsLeft,
  progressPercent,
  formatCurrency,
  isFullyPaid,
} from './loanUtils'

type Props = { loan: Loan }

export default function LoanCard({ loan }: Props) {
  const navigate = useNavigate()
  const pct = progressPercent(loan)
  const remaining = remainingBalance(loan)
  const left = monthsLeft(loan)
  const paid = isFullyPaid(loan)
  const color = loan.color || DEFAULT_COLOR

  return (
    <button
      onClick={() => navigate(`/loan/${loan.id}`)}
      className="w-full bg-card rounded-2xl p-4 border border-themed text-left transition-all duration-200 active:scale-[0.97] hover:bg-card-hover group"
    >
      {/* Top row */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div
            className="w-10 h-10 rounded-[13px] flex items-center justify-center text-[14px] font-bold text-white"
            style={{ backgroundColor: paid ? '#10B981' : color }}
          >
            {loan.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h3 className="font-semibold text-primary text-[15px] leading-tight tracking-tight">{loan.name}</h3>
              {loan.tag && (
                <span className="text-[10px] font-semibold text-muted bg-subtle px-1.5 py-[1px] rounded-md">{loan.tag}</span>
              )}
            </div>
            {loan.interestRate > 0 && (
              <span className="text-[11px] text-muted">{loan.interestRate}%/mo</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {paid && (
            <span className="text-[11px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2.5 py-0.5 rounded-full">
              Paid
            </span>
          )}
          <ChevronRight className="w-4 h-4 text-muted group-hover:text-secondary transition-colors" />
        </div>
      </div>

      {/* Amounts */}
      <div className="flex justify-between items-end mb-4">
        <div>
          <p className="text-[11px] font-medium text-muted uppercase tracking-wider mb-0.5">Monthly</p>
          <p className="text-[20px] font-bold tracking-tight leading-none" style={{ color }}>{formatCurrency(loan.monthlyPayment)}</p>
        </div>
        <div className="text-right">
          <p className="text-[11px] font-medium text-muted uppercase tracking-wider mb-0.5">Remaining</p>
          <p className="text-[20px] font-bold text-primary tracking-tight leading-none">{formatCurrency(remaining)}</p>
        </div>
      </div>

      {/* Progress */}
      <div className="mb-2.5">
        <div className="w-full h-[6px] rounded-full overflow-hidden" style={{ backgroundColor: `${color}15` }}>
          <div
            className="h-[6px] rounded-full transition-all duration-700 ease-out"
            style={{
              width: `${Math.max(pct, 2)}%`,
              background: `linear-gradient(90deg, ${color}, ${color}dd)`,
            }}
          />
        </div>
      </div>

      <div className="flex justify-between items-center">
        <span
          className="text-[11px] font-semibold px-2.5 py-[3px] rounded-full"
          style={{ backgroundColor: `${color}10`, color }}
        >
          {pct}%
        </span>
        <span className="text-[12px] text-muted">
          {left} {left === 1 ? 'month' : 'months'} left
        </span>
      </div>
    </button>
  )
}
