import { useState, useMemo, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Calendar, ChevronLeft, ChevronRight } from 'lucide-react'
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

type Period = { year: number; month: number; half: 1 | 2 }

function periodLabel(p: Period): string {
  const monthName = new Date(p.year, p.month).toLocaleString('en-US', { month: 'short' })
  const range = p.half === 1 ? '1 – 15' : '16 – 31'
  return `${monthName} ${range}`
}

function periodMonthYear(p: Period): string {
  return new Date(p.year, p.month).toLocaleString('en-US', { month: 'long', year: 'numeric' })
}

function shiftPeriod(p: Period, delta: number): Period {
  let { year, month, half } = p
  const totalHalves = (year * 12 + month) * 2 + (half - 1) + delta
  const monthIndex = Math.floor(totalHalves / 2)
  return {
    year: Math.floor(monthIndex / 12),
    month: monthIndex % 12,
    half: (totalHalves % 2 === 0 ? 1 : 2) as 1 | 2,
  }
}

function currentPeriod(): Period {
  const now = new Date()
  return {
    year: now.getFullYear(),
    month: now.getMonth(),
    half: now.getDate() <= 15 ? 1 : 2,
  }
}

function periodsEqual(a: Period, b: Period): boolean {
  return a.year === b.year && a.month === b.month && a.half === b.half
}

function isLoanActiveInPeriod(loan: Loan, period: Period): boolean {
  const start = new Date(loan.startDate)
  const startYear = start.getFullYear()
  const startMonth = start.getMonth()

  // Loan end: startDate + durationMonths
  const endDate = new Date(loan.startDate)
  endDate.setMonth(endDate.getMonth() + loan.durationMonths)
  const endYear = endDate.getFullYear()
  const endMonth = endDate.getMonth()
  const endDay = endDate.getDate()

  // Period start month/year
  const pStart = period.year * 12 + period.month
  const lStart = startYear * 12 + startMonth
  const lEnd = endYear * 12 + endMonth

  // Loan hasn't started yet in this period's month
  if (pStart < lStart) return false
  // Loan finished before this period
  if (pStart > lEnd) return false
  // If same month as end, check if the due day falls before loan end day
  if (pStart === lEnd) {
    const dueDay = getDueDay(loan)
    if (dueDay > endDay) return false
  }

  return true
}

function getLoansForPeriod(loans: Loan[], period: Period): Loan[] {
  return loans.filter((loan) => {
    if (isFullyPaid(loan)) return false
    const dueDay = getDueDay(loan)
    const inHalf = period.half === 1 ? dueDay <= 15 : dueDay > 15
    if (!inHalf) return false
    return isLoanActiveInPeriod(loan, period)
  })
}

export default function PaySchedule() {
  const navigate = useNavigate()
  const { loans } = useLoanStore()
  const [period, setPeriod] = useState<Period>(currentPeriod)
  const isCurrent = periodsEqual(period, currentPeriod())

  const periodLoans = useMemo(() => getLoansForPeriod(loans, period), [loans, period])
  const total = useMemo(() => periodLoans.reduce((s, l) => s + l.monthlyPayment, 0), [periodLoans])

  // Swipe support
  const touchStartX = useRef<number | null>(null)
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX
  }, [])
  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (touchStartX.current === null) return
    const diff = e.changedTouches[0].clientX - touchStartX.current
    if (Math.abs(diff) > 50) {
      setPeriod((p) => shiftPeriod(p, diff < 0 ? 1 : -1))
    }
    touchStartX.current = null
  }, [])

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
              <p className="text-[12px] text-white/60">Browse by pay period</p>
            </div>
          </div>

          {/* Period navigator */}
          <div
            className="flex items-center justify-between rounded-2xl bg-white/15 border border-white/10 px-2 py-2.5"
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          >
            <button
              onClick={() => setPeriod((p) => shiftPeriod(p, -1))}
              className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"
            >
              <ChevronLeft className="w-4.5 h-4.5 text-white" />
            </button>
            <button
              onClick={() => setPeriod(currentPeriod())}
              className="flex flex-col items-center min-w-0"
            >
              <span className="text-[15px] font-bold text-white tracking-tight">
                {periodLabel(period)}
              </span>
              <span className="text-[11px] text-white/50">
                {isCurrent ? 'Current period' : periodMonthYear(period)}
              </span>
            </button>
            <button
              onClick={() => setPeriod((p) => shiftPeriod(p, 1))}
              className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"
            >
              <ChevronRight className="w-4.5 h-4.5 text-white" />
            </button>
          </div>

          {/* Summary */}
          <div className="mt-3 flex items-center justify-between px-1">
            <span className="text-[12px] text-white/60">
              {periodLoans.length} {periodLoans.length === 1 ? 'loan' : 'loans'} due
            </span>
            <span className="text-xl font-bold text-white tracking-tight">{formatCurrency(total)}</span>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-3 pt-4 pb-8">
        {periodLoans.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <Calendar className="w-8 h-8 text-muted mb-3" />
            <p className="text-[14px] font-medium text-secondary">No loans due</p>
            <p className="text-[13px] text-muted">No payments in this period</p>
          </div>
        ) : (
          <div className="space-y-2">
            {periodLoans.map((loan) => (
              <ScheduleCard key={loan.id} loan={loan} onClick={() => navigate(`/loan/${loan.id}`)} />
            ))}
          </div>
        )}
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
