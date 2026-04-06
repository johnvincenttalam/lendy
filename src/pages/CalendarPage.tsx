import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight, CalendarDays, ListFilter } from 'lucide-react'
import { useLoanStore } from '../features/loans/loanStore'
import { formatCurrency, paymentSchedule } from '../features/loans/loanUtils'
import { DEFAULT_COLOR } from '../features/loans/loanTypes'
import { BRAND_GRADIENT } from '../constants/styles'
import type { Loan } from '../features/loans/loanTypes'

type CalendarPayment = {
  loan: Loan
  amount: number
  isPaid: boolean
  isOverdue: boolean
  month: number
}

function getPaymentsForMonth(loans: Loan[], year: number, month: number): Map<number, CalendarPayment[]> {
  const payments = new Map<number, CalendarPayment[]>()
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  for (const loan of loans) {
    if (loan.archived) continue
    const schedule = paymentSchedule(loan)

    for (let i = 0; i < schedule.length; i++) {
      const p = schedule[i]
      if (p.date.getFullYear() === year && p.date.getMonth() === month) {
        const day = p.date.getDate()
        const existing = payments.get(day) || []
        const isPaid = i < loan.monthsPaid
        const dueDate = new Date(p.date)
        dueDate.setHours(0, 0, 0, 0)
        const isOverdue = !isPaid && dueDate < today
        existing.push({
          loan,
          amount: p.payment,
          isPaid,
          isOverdue,
          month: i + 1,
        })
        payments.set(day, existing)
      }
    }
  }

  return payments
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate()
}

function getFirstDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 1).getDay()
}

export default function CalendarPage() {
  const navigate = useNavigate()
  const { loans } = useLoanStore()
  const activeLoans = loans.filter((l) => !l.archived)

  const today = new Date()
  const [viewYear, setViewYear] = useState(today.getFullYear())
  const [viewMonth, setViewMonth] = useState(today.getMonth())
  const [selectedDay, setSelectedDay] = useState<number | null>(null)

  const payments = useMemo(
    () => getPaymentsForMonth(activeLoans, viewYear, viewMonth),
    [activeLoans, viewYear, viewMonth]
  )

  const daysInMonth = getDaysInMonth(viewYear, viewMonth)
  const firstDay = getFirstDayOfMonth(viewYear, viewMonth)
  const monthName = new Date(viewYear, viewMonth).toLocaleString('en-US', {
    month: 'long',
    year: 'numeric',
  })

  const isCurrentMonth = viewYear === today.getFullYear() && viewMonth === today.getMonth()

  const goToPrevMonth = () => {
    if (viewMonth === 0) {
      setViewYear(viewYear - 1)
      setViewMonth(11)
    } else {
      setViewMonth(viewMonth - 1)
    }
    setSelectedDay(null)
  }

  const goToNextMonth = () => {
    if (viewMonth === 11) {
      setViewYear(viewYear + 1)
      setViewMonth(0)
    } else {
      setViewMonth(viewMonth + 1)
    }
    setSelectedDay(null)
  }

  const goToToday = () => {
    setViewYear(today.getFullYear())
    setViewMonth(today.getMonth())
    setSelectedDay(null)
  }

  // Calculate monthly totals
  const monthlyTotal = useMemo(() => {
    let total = 0
    let paid = 0
    payments.forEach((dayPayments) => {
      dayPayments.forEach((p) => {
        total += p.amount
        if (p.isPaid) paid += p.amount
      })
    })
    return { total, paid, pending: total - paid }
  }, [payments])

  const selectedPayments = selectedDay ? payments.get(selectedDay) || [] : []

  return (
    <div className="min-h-screen bg-page transition-colors duration-300">
      <div style={{ background: BRAND_GRADIENT }}>
        <div className="max-w-2xl mx-auto px-4 pt-5 pb-5">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h1 className="text-[22px] font-bold text-white tracking-tight leading-tight">
                Payment Calendar
              </h1>
              <p className="text-[12px] text-white/55 font-medium">View all payments at a glance</p>
            </div>
            <button
              onClick={() => navigate('/schedule')}
              className="flex items-center gap-1.5 text-[11px] font-semibold text-white/70 hover:text-white transition-colors bg-white/10 px-3 py-1.5 rounded-full"
            >
              <ListFilter className="w-3.5 h-3.5" />
              Cycle View
            </button>
          </div>

          {/* Month navigator */}
          <div className="flex items-center justify-between rounded-2xl bg-white/[0.13] backdrop-blur-sm border border-white/[0.12] px-2 py-2.5">
            <button
              onClick={goToPrevMonth}
              className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"
            >
              <ChevronLeft className="w-4.5 h-4.5 text-white" />
            </button>
            <button onClick={goToToday} className="flex flex-col items-center min-w-0">
              <span className="text-[15px] font-bold text-white tracking-tight">{monthName}</span>
              <span className="text-[11px] text-white/50">
                {isCurrentMonth ? 'Current month' : 'Tap to go to today'}
              </span>
            </button>
            <button
              onClick={goToNextMonth}
              className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"
            >
              <ChevronRight className="w-4.5 h-4.5 text-white" />
            </button>
          </div>

          {/* Monthly summary */}
          <div className="mt-3 flex items-center justify-between px-1">
            <div className="flex items-center gap-3">
              <span className="text-[12px] text-white/60">
                <span className="text-emerald-300">{formatCurrency(monthlyTotal.paid)}</span> paid
              </span>
              <span className="text-[12px] text-white/60">
                <span className="text-white">{formatCurrency(monthlyTotal.pending)}</span> pending
              </span>
            </div>
            <span className="text-xl font-bold text-white tracking-tight">
              {formatCurrency(monthlyTotal.total)}
            </span>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 pt-4 pb-28">
        {/* Calendar grid */}
        <div className="bg-card rounded-2xl border border-themed p-3 transition-colors">
          {/* Weekday headers */}
          <div className="grid grid-cols-7 mb-2">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
              <div key={day} className="text-center text-[10px] font-semibold text-muted uppercase">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar days */}
          <div className="grid grid-cols-7 gap-1">
            {/* Empty cells for days before the first of the month */}
            {Array.from({ length: firstDay }).map((_, i) => (
              <div key={`empty-${i}`} className="aspect-square" />
            ))}

            {/* Days of the month */}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1
              const dayPayments = payments.get(day) || []
              const isToday = isCurrentMonth && day === today.getDate()
              const isSelected = selectedDay === day
              const hasPayments = dayPayments.length > 0

              return (
                <button
                  key={day}
                  onClick={() => setSelectedDay(isSelected ? null : day)}
                  className={`aspect-square rounded-xl flex items-center justify-center transition-all relative ${
                    isSelected
                      ? 'bg-brand text-white'
                      : isToday
                        ? 'bg-brand/10 text-brand font-bold'
                        : 'hover:bg-subtle'
                  }`}
                >
                  <span
                    className={`text-[13px] ${isSelected ? 'font-bold' : ''} ${
                      !isSelected && !isToday ? 'text-primary' : ''
                    }`}
                  >
                    {day}
                  </span>
                  {hasPayments && (
                    <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 flex gap-0.5">
                      {dayPayments.slice(0, 3).map((p, idx) => (
                        <div
                          key={idx}
                          className={`w-1.5 h-1.5 rounded-full ${
                            isSelected
                              ? 'bg-white/70'
                              : p.isPaid
                                ? 'bg-emerald-500'
                                : p.isOverdue
                                  ? 'bg-red-500'
                                  : 'bg-brand'
                          }`}
                        />
                      ))}
                      {dayPayments.length > 3 && (
                        <span className={`text-[8px] leading-none ${isSelected ? 'text-white/70' : 'text-muted'}`}>
                          +{dayPayments.length - 3}
                        </span>
                      )}
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center justify-center gap-4 mt-3">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-brand" />
            <span className="text-[11px] text-muted">Pending</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-red-500" />
            <span className="text-[11px] text-muted">Overdue</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="text-[11px] text-muted">Paid</span>
          </div>
        </div>

        {/* Selected day details */}
        {selectedDay && (
          <div className="mt-4 space-y-2">
            <h3 className="text-[13px] font-semibold text-secondary px-1">
              {new Date(viewYear, viewMonth, selectedDay).toLocaleDateString('en-US', {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
              })}
            </h3>
            {selectedPayments.length === 0 ? (
              <div className="bg-card rounded-2xl border border-themed p-4 text-center">
                <p className="text-[13px] text-muted">No payments on this day</p>
              </div>
            ) : (
              selectedPayments.map((p) => (
                <button
                  key={p.loan.id}
                  onClick={() => navigate(`/loan/${p.loan.id}`)}
                  className="w-full bg-card rounded-2xl p-4 border border-themed text-left transition-all duration-200 active:scale-[0.97] hover:bg-card-hover"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-[13px] flex items-center justify-center text-white text-[14px] font-bold shrink-0"
                      style={{ backgroundColor: p.loan.color || DEFAULT_COLOR }}
                    >
                      {p.loan.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <h4 className="font-semibold text-primary text-[14px] truncate">
                          {p.loan.name}
                        </h4>
                        <span
                          className="text-[14px] font-bold tracking-tight ml-2"
                          style={{ color: p.loan.color || DEFAULT_COLOR }}
                        >
                          {formatCurrency(p.amount)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between mt-0.5">
                        <span className="text-[11px] text-muted">
                          Payment {p.month}/{p.loan.durationMonths}
                        </span>
                        <span
                          className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-md ${
                            p.isPaid
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                              : p.isOverdue
                                ? 'bg-red-500/10 text-red-500'
                                : 'bg-brand/10 text-brand'
                          }`}
                        >
                          {p.isPaid ? 'Paid' : p.isOverdue ? 'Overdue' : 'Pending'}
                        </span>
                      </div>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        )}

        {/* Empty state when no loans */}
        {activeLoans.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="w-14 h-14 rounded-2xl bg-card border border-themed flex items-center justify-center mb-3">
              <CalendarDays className="w-6 h-6 text-muted" />
            </div>
            <p className="text-[14px] font-semibold text-secondary">No loans yet</p>
            <p className="text-[13px] text-muted">Add loans to see them on the calendar</p>
          </div>
        )}
      </div>
    </div>
  )
}
