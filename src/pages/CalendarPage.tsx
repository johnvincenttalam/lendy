import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react'
import { useLoanStore } from '../features/loans/loanStore'
import { formatCurrency, paymentSchedule } from '../features/loans/loanUtils'
import { DEFAULT_COLOR } from '../features/loans/loanTypes'
import { BRAND_GRADIENT } from '../constants/styles'
import EmptyState from '../components/EmptyState'
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
  const scheduleRef = useRef<HTMLDivElement>(null)

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

  // Flatten the month's payments and split into half-month groups (1–15 / 16–end)
  const scheduleGroups = useMemo(() => {
    const all: (CalendarPayment & { day: number })[] = []
    payments.forEach((dayPayments, day) => {
      dayPayments.forEach((p) => all.push({ ...p, day }))
    })
    all.sort((a, b) => a.day - b.day || a.loan.name.localeCompare(b.loan.name))

    const sum = (arr: (CalendarPayment & { day: number })[]) =>
      arr.reduce((s, p) => s + p.amount, 0)

    const firstHalf = all.filter((p) => p.day <= 15)
    const secondHalf = all.filter((p) => p.day > 15)

    const groups: { key: string; label: string; total: number; items: typeof all }[] = []
    if (firstHalf.length) groups.push({ key: 'h1', label: '1 – 15', total: sum(firstHalf), items: firstHalf })
    if (secondHalf.length) groups.push({ key: 'h2', label: `16 – ${daysInMonth}`, total: sum(secondHalf), items: secondHalf })
    return { groups, count: all.length }
  }, [payments, daysInMonth])

  // Scroll the schedule to the first card of the tapped day
  useEffect(() => {
    if (!selectedDay || !scheduleRef.current) return
    const target = scheduleRef.current.querySelector<HTMLElement>(`[data-day="${selectedDay}"]`)
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    target?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' })
  }, [selectedDay])

  return (
    <div className="min-h-screen bg-page transition-colors duration-300">
      <div style={{ background: BRAND_GRADIENT }}>
        <div className="max-w-2xl mx-auto px-4 pt-5 pb-5">
          <div className="mb-4">
            <h1 className="text-[22px] font-bold text-white tracking-tight leading-tight">
              Payment Calendar
            </h1>
            <p className="text-[12px] text-white/55 font-medium">View all payments at a glance</p>
          </div>

          {/* Month navigator */}
          <div className="flex items-center justify-between rounded-2xl bg-white/[0.13] backdrop-blur-sm border border-white/[0.12] px-2 py-2.5">
            <button
              onClick={goToPrevMonth}
              aria-label="Previous month"
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
              aria-label="Next month"
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
        {activeLoans.length > 0 && (
          <div className="flex items-center justify-center gap-3.5 mt-2.5">
            {([
              ['bg-brand', 'Pending'],
              ['bg-red-500', 'Overdue'],
              ['bg-emerald-500', 'Paid'],
            ] as const).map(([dot, label]) => (
              <div key={label} className="flex items-center gap-1">
                <div className={`w-1.5 h-1.5 rounded-full ${dot}`} />
                <span className="text-[10px] text-muted">{label}</span>
              </div>
            ))}
          </div>
        )}

        {/* Month schedule, grouped by half-month */}
        {activeLoans.length > 0 && (
          <div className="mt-5" ref={scheduleRef}>
            <div className="flex items-center justify-between px-1 mb-3">
              <h2 className="text-[15px] font-bold text-primary tracking-tight">
                {monthName.split(' ')[0]} Schedule
              </h2>
              {selectedDay ? (
                <button
                  onClick={() => setSelectedDay(null)}
                  className="text-[11px] font-semibold text-brand hover:opacity-80 transition-opacity"
                >
                  Clear
                </button>
              ) : (
                <span className="text-[11px] text-muted">
                  {scheduleGroups.count} {scheduleGroups.count === 1 ? 'payment' : 'payments'}
                </span>
              )}
            </div>

            {scheduleGroups.count === 0 ? (
              <div className="bg-card rounded-2xl border border-themed p-5 text-center">
                <p className="text-[13px] text-muted">No payments scheduled this month</p>
              </div>
            ) : (
              <div className="space-y-5">
                {scheduleGroups.groups.map((group) => {
                  return (
                    <div key={group.key} className="space-y-2">
                      {/* Group header */}
                      <div className="flex items-center justify-between px-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[12px] font-bold text-secondary tracking-tight">{group.label}</span>
                          <span className="text-[10px] font-semibold text-muted bg-subtle px-1.5 py-0.5 rounded-md">
                            {group.items.length}
                          </span>
                        </div>
                        <span className="text-[12px] font-semibold text-muted tracking-tight">
                          {formatCurrency(group.total)}
                        </span>
                      </div>

                      {/* Cards */}
                      {group.items.map((p) => {
                        const weekday = new Date(viewYear, viewMonth, p.day).toLocaleDateString('en-US', {
                          weekday: 'short',
                        })
                        const isHighlighted = selectedDay === p.day
                        const color = p.loan.color || DEFAULT_COLOR
                        return (
                          <button
                            key={`${p.loan.id}-${p.day}`}
                            data-day={p.day}
                            onClick={() => navigate(`/loan/${p.loan.id}`)}
                            className={`w-full bg-card rounded-2xl p-3 border text-left transition-all duration-200 active:scale-[0.97] hover:bg-card-hover ${
                              isHighlighted ? 'border-brand ring-1 ring-brand animate-pulse-highlight' : 'border-themed'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              {/* Date pill */}
                              <div className="flex flex-col items-center justify-center w-10 shrink-0">
                                <span className="text-[10px] font-semibold text-muted uppercase leading-none mb-0.5">
                                  {weekday}
                                </span>
                                <span className="text-[18px] font-bold text-primary leading-none">{p.day}</span>
                              </div>
                              <div className="w-px h-9 bg-divider shrink-0" />
                              {/* Avatar */}
                              <div
                                className="w-9 h-9 rounded-[12px] flex items-center justify-center text-white text-[13px] font-bold shrink-0"
                                style={{ backgroundColor: p.isPaid ? '#10B981' : color }}
                              >
                                {p.loan.name.charAt(0).toUpperCase()}
                              </div>
                              {/* Details */}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-2">
                                  <h4 className="font-semibold text-primary text-[14px] truncate">{p.loan.name}</h4>
                                  <span className="text-[14px] font-bold tracking-tight" style={{ color }}>
                                    {formatCurrency(p.amount)}
                                  </span>
                                </div>
                                <div className="flex items-center justify-between mt-0.5 gap-2">
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
                        )
                      })}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* Empty state when no loans */}
        {activeLoans.length === 0 && (
          <EmptyState
            icon={CalendarDays}
            title="No loans yet"
            subtitle="Add loans to see them on the calendar"
          />
        )}
      </div>
    </div>
  )
}
