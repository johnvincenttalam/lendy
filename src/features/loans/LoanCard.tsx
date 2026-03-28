import { useNavigate } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
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
  const color = loan.color || '#F3622D'

  return (
    <button
      onClick={() => navigate(`/loan/${loan.id}`)}
      className="w-full bg-card rounded-2xl p-4 border border-themed text-left transition-all duration-200 active:scale-[0.97] hover:bg-card-hover group"
    >
      {/* Top row */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold text-white"
            style={{ backgroundColor: paid ? '#10B981' : color }}
          >
            {loan.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <h3 className="font-semibold text-primary text-[15px] leading-tight tracking-tight">{loan.name}</h3>
            {loan.interestRate > 0 && (
              <span className="text-[11px] text-muted">{loan.interestRate}%/mo</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {paid && (
            <span className="text-[11px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-full">
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
        <div className="w-full h-[6px] rounded-full" style={{ backgroundColor: `${color}18` }}>
          <div
            className="h-[6px] rounded-full transition-all duration-700 ease-out"
            style={{ width: `${Math.max(pct, 2)}%`, backgroundColor: color }}
          />
        </div>
      </div>

      <div className="flex justify-between items-center">
        <span
          className="text-[11px] font-semibold px-2 py-[3px] rounded-full"
          style={{ backgroundColor: `${color}12`, color }}
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
