import { describe, it, expect } from 'vitest'
import type { Loan, PaymentRecord } from '../loans/loanTypes'
import { paymentSchedule } from '../loans/loanUtils'
import {
  selectOllieSituation, duePaymentFor, findCelebratablePayment, collectInsights,
  calendarDaysBetween, localISODate,
} from './ollieUtils'
import type { OllieInput } from './ollieTypes'

// Mid-morning local time, well clear of midnight in any direction.
const NOW = new Date(2026, 10, 24, 10, 0, 0) // Nov 24, 2026

/** YYYY-MM-DD for `NOW` shifted by `days` — the app stores startDate in this form. */
function dayOffset(days: number): string {
  const d = new Date(NOW)
  d.setDate(d.getDate() + days)
  return localISODate(d)
}

function makeLoan(overrides: Partial<Loan> = {}): Loan {
  return {
    id: 'loan-1',
    name: 'Phone',
    color: '#F3622D',
    totalAmount: 12000,
    monthlyPayment: 1000,
    interestRate: 0,
    durationMonths: 12,
    startDate: dayOffset(20),
    monthsPaid: 0,
    totalPaid: 0,
    totalInterestPaid: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

function makePayment(overrides: Partial<PaymentRecord> = {}): PaymentRecord {
  return {
    id: 'pay-1',
    loanId: 'loan-1',
    amount: 1000,
    principal: 1000,
    interest: 0,
    paidAt: new Date(NOW.getTime() - 60 * 60 * 1000).toISOString(),
    dueDate: '2026-11-20',
    month: 1,
    ...overrides,
  }
}

function input(overrides: Partial<OllieInput> = {}): OllieInput {
  return {
    loans: [],
    payments: [],
    now: NOW,
    reminderDays: 3,
    monthlyIncome: 0,
    celebratedIds: new Set(),
    seenInsights: {},
    greetingEligible: false,
    ...overrides,
  }
}

describe('calendarDaysBetween', () => {
  it('counts calendar days regardless of time of day', () => {
    expect(calendarDaysBetween(new Date(2026, 10, 24, 23, 59), new Date(2026, 10, 25, 0, 1))).toBe(1)
    expect(calendarDaysBetween(new Date(2026, 10, 24), new Date(2026, 10, 20))).toBe(-4)
  })
})

describe('duePaymentFor', () => {
  it('returns null for paid off or archived loans', () => {
    expect(duePaymentFor(makeLoan({ monthsPaid: 12 }), NOW)).toBeNull()
    expect(duePaymentFor(makeLoan({ archived: true }), NOW)).toBeNull()
  })

  it('sums every missed instalment when a loan is behind', () => {
    // Started ~2 months ago, nothing paid: two instalments are past due.
    const start = new Date(NOW)
    start.setMonth(start.getMonth() - 2)
    start.setDate(start.getDate() - 1)
    const loan = makeLoan({ startDate: localISODate(start) })
    const due = duePaymentFor(loan, NOW)!
    expect(due.installments).toBe(3)
    expect(due.amount).toBe(3000)
    expect(due.daysUntil).toBeLessThan(0)
  })

  it('uses the scheduled amount, including the final-payment adjustment', () => {
    const loan = makeLoan({ totalAmount: 1000, monthlyPayment: 333.33, durationMonths: 3, monthsPaid: 2, startDate: dayOffset(-55) })
    const finalScheduled = paymentSchedule(loan)[2].payment
    expect(duePaymentFor(loan, NOW)!.amount).toBe(finalScheduled)
  })
})

describe('selectOllieSituation — priority', () => {
  it('greets new users with no loans', () => {
    const s = selectOllieSituation(input())
    expect(s.kind).toBe('greeting')
    expect(s.kind === 'greeting' && s.hasLoans).toBe(false)
  })

  it('puts overdue above everything else', () => {
    const s = selectOllieSituation(input({
      loans: [
        makeLoan({ id: 'late', startDate: dayOffset(-5) }),
        makeLoan({ id: 'today', startDate: dayOffset(0) }),
        makeLoan({ id: 'soon', startDate: dayOffset(1) }),
      ],
      payments: [makePayment({ loanId: 'soon' })],
    }))
    expect(s.kind).toBe('overdue')
    if (s.kind !== 'overdue') return
    expect(s.payments.map((p) => p.loan.id)).toEqual(['late'])
    expect(s.payments[0].daysUntil).toBe(-5)
  })

  it('flags a payment due today as due-today, not upcoming or relaxed', () => {
    const s = selectOllieSituation(input({
      loans: [makeLoan({ id: 'today', startDate: dayOffset(0) }), makeLoan({ id: 'soon', startDate: dayOffset(2) })],
    }))
    expect(s.kind).toBe('due-today')
    if (s.kind !== 'due-today') return
    expect(s.payments.map((p) => p.loan.id)).toEqual(['today'])
    expect(s.total).toBe(1000)
  })

  it('treats payments within 3 days as "soon" and within the week as "week"', () => {
    const soon = selectOllieSituation(input({ loans: [makeLoan({ startDate: dayOffset(3) })] }))
    expect(soon.kind === 'upcoming' && soon.tier).toBe('soon')

    const week = selectOllieSituation(input({ loans: [makeLoan({ startDate: dayOffset(6) })] }))
    expect(week.kind === 'upcoming' && week.tier).toBe('week')
    expect(week.kind === 'upcoming' && week.payments[0].daysUntil).toBe(6)
  })

  it('stretches the upcoming window to a longer reminder setting', () => {
    const loans = [makeLoan({ startDate: dayOffset(10) })]
    expect(selectOllieSituation(input({ loans })).kind).toBe('relaxed')
    expect(selectOllieSituation(input({ loans, reminderDays: 14 })).kind).toBe('upcoming')
  })

  it('ignores archived and fully paid loans when looking for due payments', () => {
    const s = selectOllieSituation(input({
      loans: [
        makeLoan({ id: 'archived', startDate: dayOffset(-3), archived: true }),
        makeLoan({ id: 'paid', startDate: dayOffset(-3), monthsPaid: 12, totalPaid: 12000 }),
        makeLoan({ id: 'later', startDate: dayOffset(20) }),
      ],
      // The paid-off loan puts overall progress at 50% — already seen.
      seenInsights: { 'milestone:50': '2026-11-01' },
    }))
    expect(s.kind).toBe('relaxed')
    expect(s.kind === 'relaxed' && s.next?.loan.id).toBe('later')
  })

  it('celebrates a fresh payment only when nothing is due', () => {
    const loans = [makeLoan({ startDate: dayOffset(-10), monthsPaid: 1, totalPaid: 1000 })]
    const payments = [makePayment()]
    const s = selectOllieSituation(input({ loans, payments }))
    expect(s.kind).toBe('celebrating')
    if (s.kind !== 'celebrating') return
    expect(s.remaining).toBe(11000)
    expect(s.paymentsLeft).toBe(11)
    expect(s.fullyPaid).toBe(false)

    const withDue = selectOllieSituation(input({ loans: [...loans, makeLoan({ id: 'soon', startDate: dayOffset(1) })], payments }))
    expect(withDue.kind).toBe('upcoming')
  })

  it('does not celebrate the same payment twice', () => {
    const loans = [makeLoan({ startDate: dayOffset(-10), monthsPaid: 1, totalPaid: 1000 })]
    const s = selectOllieSituation(input({ loans, payments: [makePayment()], celebratedIds: new Set(['pay-1']) }))
    expect(s.kind).toBe('relaxed')
  })

  it('shows an insight before the greeting, and only on the day it is first seen', () => {
    const loans = [makeLoan({ startDate: dayOffset(-320), monthsPaid: 11, totalPaid: 11000 })]
    const first = selectOllieSituation(input({ loans, greetingEligible: true }))
    expect(first.kind).toBe('insight')
    if (first.kind !== 'insight') return
    expect(first.insight.type).toBe('finish-line')

    const laterToday = selectOllieSituation(input({ loans, seenInsights: { [first.insightKey]: localISODate(NOW) } }))
    expect(laterToday.kind).toBe('insight')

    const seenYesterday = { [first.insightKey]: '2026-11-23', 'debtfree:2027-1': '2026-11-23', 'milestone:75': '2026-11-23' }
    expect(selectOllieSituation(input({ loans, seenInsights: seenYesterday, greetingEligible: true })).kind).toBe('greeting')
  })

  it('greets on the first visit of the day, then relaxes', () => {
    const loans = [makeLoan({ startDate: dayOffset(20) })]
    expect(selectOllieSituation(input({ loans, greetingEligible: true })).kind).toBe('greeting')
    expect(selectOllieSituation(input({ loans })).kind).toBe('relaxed')
  })

  it('reports all-paid-off when every tracked loan is done', () => {
    const s = selectOllieSituation(input({ loans: [makeLoan({ startDate: dayOffset(-400), monthsPaid: 12, totalPaid: 12000 })] }))
    expect(s.kind === 'relaxed' && s.allPaidOff).toBe(true)
  })
})

describe('findCelebratablePayment', () => {
  const loans = [makeLoan({ startDate: dayOffset(-10), monthsPaid: 1, totalPaid: 1000 })]

  it('skips payments older than a day', () => {
    const old = makePayment({ paidAt: new Date(NOW.getTime() - 25 * 60 * 60 * 1000).toISOString() })
    expect(findCelebratablePayment([old], loans, new Set(), NOW)).toBeNull()
  })

  it('skips migration-backfilled records', () => {
    const scheduled = paymentSchedule(loans[0])[0].date
    const backfilled = makePayment({ paidAt: scheduled.toISOString(), dueDate: scheduled.toISOString().split('T')[0] })
    // Backfilled timestamp lands 10 days ago — also old — so force it recent via a matching loan.
    const recentLoan = makeLoan({ startDate: localISODate(NOW), monthsPaid: 1, totalPaid: 1000 })
    const recentScheduled = paymentSchedule(recentLoan)[0].date
    const recentBackfill = makePayment({ paidAt: recentScheduled.toISOString(), dueDate: recentScheduled.toISOString().split('T')[0] })
    expect(findCelebratablePayment([backfilled], loans, new Set(), NOW)).toBeNull()
    expect(findCelebratablePayment([recentBackfill], [recentLoan], new Set(), NOW)).toBeNull()
  })

  it('picks the most recent eligible payment', () => {
    const a = makePayment({ id: 'a', paidAt: new Date(NOW.getTime() - 3 * 3600_000).toISOString() })
    const b = makePayment({ id: 'b', paidAt: new Date(NOW.getTime() - 1 * 3600_000).toISOString() })
    expect(findCelebratablePayment([a, b], loans, new Set(), NOW)?.payment.id).toBe('b')
  })
})

describe('collectInsights', () => {
  it('flags high debt-to-income once per month', () => {
    const loans = [makeLoan({ monthlyPayment: 1000 })]
    const insights = collectInsights(loans, 2000, NOW)
    expect(insights.find((i) => i.insight.type === 'high-dti')?.key).toBe('dti:2026-11')
  })

  it('returns nothing when every loan is paid off', () => {
    expect(collectInsights([makeLoan({ monthsPaid: 12, totalPaid: 12000 })], 2000, NOW)).toEqual([])
  })

  it('suggests a backup once a month, after the other insights, even with every loan paid off', () => {
    const insights = collectInsights([makeLoan({ monthlyPayment: 1000 })], 2000, NOW, null)
    expect(insights.at(-1)).toEqual({ key: 'backup:2026-11', insight: { type: 'backup-due', daysSince: null } })
    const paidOff = collectInsights([makeLoan({ monthsPaid: 12, totalPaid: 12000 })], 2000, NOW, null)
    expect(paidOff.map((i) => i.insight.type)).toEqual(['backup-due'])
  })

  it('stays quiet about backups after a recent one, or with only private loans', () => {
    const recent = new Date(NOW.getTime() - 3 * 86_400_000).toISOString()
    expect(collectInsights([makeLoan({ monthlyPayment: 1 })], 0, NOW, recent)).toEqual([])
    expect(collectInsights([makeLoan({ private: true })], 0, NOW, null)).toEqual([])
  })
})

describe('private loans', () => {
  it('never mentions private loans', () => {
    const s = selectOllieSituation(input({
      loans: [makeLoan({ id: 'secret', startDate: dayOffset(-5), private: true })],
      greetingEligible: true,
    }))
    expect(s.kind).toBe('greeting')
    expect(s.kind === 'greeting' && s.hasLoans).toBe(false)
  })
})
