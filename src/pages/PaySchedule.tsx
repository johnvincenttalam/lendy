import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Calendar, ChevronRight } from 'lucide-react'
import { useLoanStore } from '../features/loans/loanStore'
import {
  isFullyPaid,
  formatCurrency,
  remainingBalance,
  progressPercent,
} from '../features/loans/loanUtils'
import { DEFAULT_COLOR } from '../features/loans/loanTypes'
import type { Loan } from '../features/loans/loanTypes'

function getDueDay(loan: Loan): number {
  return new Date(loan.startDate).getDate()
}

function partitionByCycle(loans: Loan[]): [Loan[], Loan[]] {
  const firstHalf: Loan[] = []
  const secondHalf: Loan[] = []
  for (const loan of loans) {
    if (getDueDay(loan) <= 15) firstHalf.push(loan)
    else secondHalf.push(loan)
  }
  return [firstHalf, secondHalf]
}

const CYCLES = [
  { label: '1st – 15th', index: 0 },
  { label: '16th – 31st', index: 1 },
] as const

export default function PaySchedule() {
  const navigate = useNavigate()
  const { loans } = useLoanStore()
  const activeLoans = loans.filter((l) => !isFullyPaid(l))
  const groups = partitionByCycle(activeLoans)

  return (
    <div className="min-h-screen bg-page transition-colors duration-300">
      <div className="bg-brand">
        <div className="max-w-2xl mx-auto px-3 pt-5 pb-4">
          <div className="flex items-center gap-3 mb-4">
            <button
              onClick={() => navigate('/')}
              className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center hover:bg-white/25 transition-colors"
            >
              <ArrowLeft className="w-4.5 h-4.5 text-white" />
            </button>
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight leading-tight">Pay Schedule</h1>
              <p className="text-[12px] text-white/60">Grouped by salary cycle</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {CYCLES.map(({ label, index }) => {
              const group = groups[index]
              const total = group.reduce((s, l) => s + l.monthlyPayment, 0)
              return (
                <div key={label} className="rounded-2xl p-3.5 bg-white/15 border border-white/10">
                  <div className="flex items-center gap-1.5 mb-2">
                    <div className="w-6 h-6 rounded-lg bg-white/15 flex items-center justify-center">
                      <Calendar className="w-3.5 h-3.5 text-white" />
                    </div>
                    <span className="text-[11px] font-semibold text-white/70 uppercase tracking-wider">{label}</span>
                  </div>
                  <p className="text-xl font-bold text-white tracking-tight">{formatCurrency(total)}</p>
                  <p className="text-[11px] text-white/50 mt-0.5">{group.length} {group.length === 1 ? 'loan' : 'loans'}</p>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-3 pt-4 pb-8 space-y-5">
        {activeLoans.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <Calendar className="w-8 h-8 text-muted mb-3" />
            <p className="text-[14px] font-medium text-secondary">No active loans</p>
            <p className="text-[13px] text-muted">All loans are fully paid</p>
          </div>
        ) : (
          CYCLES.map(({ label, index }) => (
            <CycleGroup
              key={label}
              label={label}
              loans={groups[index]}
              onLoanClick={(id) => navigate(`/loan/${id}`)}
            />
          ))
        )}
      </div>
    </div>
  )
}

function CycleGroup({
  label,
  loans,
  onLoanClick,
}: {
  label: string
  loans: Loan[]
  onLoanClick: (id: string) => void
}) {
  const total = loans.reduce((s, l) => s + l.monthlyPayment, 0)

  if (loans.length === 0) {
    return (
      <div>
        <div className="flex items-center justify-between mb-2 px-1">
          <h2 className="text-[13px] font-bold text-muted uppercase tracking-wider">{label}</h2>
        </div>
        <div className="bg-card rounded-2xl border border-themed p-6 text-center">
          <p className="text-[13px] text-muted">No loans due this cycle</p>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2 px-1">
        <h2 className="text-[13px] font-bold text-muted uppercase tracking-wider">{label}</h2>
        <span className="text-[13px] font-bold text-brand">{formatCurrency(total)}</span>
      </div>
      <div className="space-y-2">
        {loans.map((loan) => (
          <ScheduleCard key={loan.id} loan={loan} onClick={() => onLoanClick(loan.id)} />
        ))}
      </div>
    </div>
  )
}

function ScheduleCard({ loan, onClick }: { loan: Loan; onClick: () => void }) {
  const color = loan.color || DEFAULT_COLOR
  const day = getDueDay(loan)
  const pct = progressPercent(loan)
  const remaining = remainingBalance(loan)

  return (
    <button
      onClick={onClick}
      className="w-full bg-card rounded-2xl p-4 border border-themed text-left transition-all duration-200 active:scale-[0.97] hover:bg-card-hover group"
    >
      <div className="flex items-center gap-3">
        <div
          className="w-10 h-10 rounded-xl flex flex-col items-center justify-center text-white shrink-0"
          style={{ backgroundColor: color }}
        >
          <span className="text-[10px] font-semibold leading-none opacity-80">Day</span>
          <span className="text-[15px] font-bold leading-none">{day}</span>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <h3 className="font-semibold text-primary text-[15px] leading-tight tracking-tight truncate">{loan.name}</h3>
            <div className="flex items-center gap-1 shrink-0 ml-2">
              <span className="text-[15px] font-bold tracking-tight" style={{ color }}>
                {formatCurrency(loan.monthlyPayment)}
              </span>
              <ChevronRight className="w-4 h-4 text-muted group-hover:text-secondary transition-colors" />
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 flex-1">
              <div className="flex-1 h-[5px] rounded-full max-w-[120px]" style={{ backgroundColor: `${color}18` }}>
                <div
                  className="h-[5px] rounded-full transition-all duration-700 ease-out"
                  style={{ width: `${Math.max(pct, 2)}%`, backgroundColor: color }}
                />
              </div>
              <span className="text-[11px] font-semibold text-muted">{pct}%</span>
            </div>
            <span className="text-[12px] text-muted ml-2">
              {formatCurrency(remaining)} left
            </span>
          </div>
        </div>
      </div>
    </button>
  )
}
