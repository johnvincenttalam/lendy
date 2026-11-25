import type { Loan, PaymentRecord } from '../loans/loanTypes'
import {
  paymentSchedule, isFullyPaid, remainingBalance, monthsLeft, totalCostOfLoan,
  debtFreeDate, debtToIncomeRatio, isTracked,
} from '../loans/loanUtils'
import { isBackfilledPayment } from '../finance/financeUtils'
import { startOfDay } from '../../utils/dateUtils'
import type { DuePayment, OllieInput, OllieInsight, OllieSituation } from './ollieTypes'

/** Payments due within this many days count as "soon" (priority 3). */
export const SOON_DAYS = 3
/** Ollie always looks at least this far ahead for upcoming payments (priority 4). */
export const MIN_WINDOW_DAYS = 7
/** A recorded payment stays celebrate-worthy for this long. */
const CELEBRATION_WINDOW_MS = 24 * 60 * 60 * 1000
/** Debt-free date close enough to call out as an insight. */
const DEBT_FREE_SOON_MONTHS = 3
/** Share of income going to loans above which Ollie suggests a review. */
export const HIGH_DTI = 0.4

/** YYYY-MM-DD in the device's own timezone (toISOString would give UTC). */
export function localISODate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/**
 * Whole calendar days from `from` to `to` in local time. Compares the local
 * y/m/d fields, so a DST shift (a 23- or 25-hour day) can't skew the count.
 */
export function calendarDaysBetween(from: Date, to: Date): number {
  const a = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate())
  const b = Date.UTC(to.getFullYear(), to.getMonth(), to.getDate())
  return Math.round((b - a) / 86_400_000)
}

/**
 * The loan's next unpaid payment relative to `now`, built from the same
 * payment schedule the rest of the app uses — so Ollie agrees with the
 * overdue banner and the amount markAsPaid will actually record. When a
 * loan is behind by several instalments, every missed one is summed.
 */
export function duePaymentFor(loan: Loan, now: Date): DuePayment | null {
  if (!isTracked(loan) || isFullyPaid(loan)) return null
  const schedule = paymentSchedule(loan)
  const next = schedule[loan.monthsPaid]
  if (!next) return null

  const today = startOfDay(now)
  const dueDate = startOfDay(next.date)
  const daysUntil = calendarDaysBetween(today, dueDate)

  if (daysUntil >= 0) {
    return { loan, dueDate, amount: next.payment, daysUntil, installments: 1 }
  }

  const missed = schedule.slice(loan.monthsPaid).filter((s) => startOfDay(s.date) < today)
  const amount = Math.round(missed.reduce((sum, s) => sum + s.payment, 0) * 100) / 100
  return { loan, dueDate, amount, daysUntil, installments: missed.length }
}

const sumAmounts = (payments: DuePayment[]) =>
  Math.round(payments.reduce((sum, p) => sum + p.amount, 0) * 100) / 100

const idsOf = (payments: DuePayment[]) => payments.map((p) => p.loan.id).sort().join(',')

/**
 * The most recent payment recorded through markAsPaid in the last day that
 * hasn't been celebrated yet. Migration-backfilled records are skipped —
 * they're history, not something the user just did.
 */
export function findCelebratablePayment(
  payments: PaymentRecord[],
  loans: Loan[],
  celebratedIds: ReadonlySet<string>,
  now: Date,
): { payment: PaymentRecord; loan: Loan } | null {
  const loansById = new Map(loans.map((l) => [l.id, l]))
  let best: { payment: PaymentRecord; loan: Loan; at: number } | null = null

  for (const payment of payments) {
    if (celebratedIds.has(payment.id)) continue
    const loan = loansById.get(payment.loanId)
    if (!loan || !isTracked(loan)) continue
    const at = new Date(payment.paidAt).getTime()
    const age = now.getTime() - at
    if (Number.isNaN(at) || age < 0 || age > CELEBRATION_WINDOW_MS) continue
    if (isBackfilledPayment(payment, loan)) continue
    if (!best || at > best.at) best = { payment, loan, at }
  }

  return best ? { payment: best.payment, loan: best.loan } : null
}

/**
 * Data-backed insights worth a moment of the user's attention, most
 * specific first. Each has a stable key so it's only "news" once.
 */
export function collectInsights(
  loans: Loan[],
  monthlyIncome: number,
  now: Date,
): Array<{ key: string; insight: OllieInsight }> {
  const tracked = loans.filter(isTracked)
  const unpaid = tracked.filter((l) => !isFullyPaid(l))
  const insights: Array<{ key: string; insight: OllieInsight }> = []
  if (unpaid.length === 0) return insights

  // 1. A loan on its final stretch.
  const closest = [...unpaid].sort((a, b) => monthsLeft(a) - monthsLeft(b))[0]
  const left = monthsLeft(closest)
  if (left > 0 && left <= 2 && closest.durationMonths > left) {
    insights.push({
      key: `finish:${closest.id}:${closest.monthsPaid}`,
      insight: { type: 'finish-line', loan: closest, paymentsLeft: left, remaining: remainingBalance(closest) },
    })
  }

  // 2. Debt-free date within reach.
  const freeOn = debtFreeDate(tracked)
  if (freeOn) {
    const monthsAway = (freeOn.getFullYear() - now.getFullYear()) * 12 + (freeOn.getMonth() - now.getMonth())
    if (monthsAway > 0 && monthsAway <= DEBT_FREE_SOON_MONTHS) {
      insights.push({
        key: `debtfree:${freeOn.getFullYear()}-${freeOn.getMonth() + 1}`,
        insight: { type: 'debt-free-soon', date: freeOn },
      })
    }
  }

  // 3. Overall payoff milestone (25 / 50 / 75 %).
  const totalCost = tracked.reduce((sum, l) => sum + totalCostOfLoan(l), 0)
  const totalPaid = tracked.reduce((sum, l) => sum + Math.min(l.totalPaid, totalCostOfLoan(l)), 0)
  if (totalCost > 0) {
    const bucket = Math.floor((totalPaid / totalCost) * 4) * 25
    if (bucket >= 25 && bucket <= 75) {
      insights.push({ key: `milestone:${bucket}`, insight: { type: 'milestone', percent: bucket } })
    }
  }

  // 4. Loan payments eating a large share of income — once a month.
  const dti = debtToIncomeRatio(tracked, monthlyIncome)
  if (dti > HIGH_DTI) {
    insights.push({
      key: `dti:${now.getFullYear()}-${now.getMonth() + 1}`,
      insight: { type: 'high-dti', percent: Math.round(dti * 100) },
    })
  }

  return insights
}

/**
 * Centralized priority logic — exactly one situation wins:
 *   1. overdue  2. due today  3. due within 3 days  4. due within the
 *   reminder window (≥ 7 days)  5. a just-recorded payment  6. an insight
 *   7. the day's first greeting  8. relaxed.
 * Relaxed is only reachable when nothing is overdue or due in the window.
 */
export function selectOllieSituation(input: OllieInput): OllieSituation {
  const { loans, payments, now, reminderDays, monthlyIncome, celebratedIds, seenInsights, greetingEligible } = input
  const today = localISODate(now)
  const windowDays = Math.max(MIN_WINDOW_DAYS, reminderDays)

  const tracked = loans.filter(isTracked)
  const due = tracked
    .map((l) => duePaymentFor(l, now))
    .filter((p): p is DuePayment => p !== null)
    .sort((a, b) => a.daysUntil - b.daysUntil || b.amount - a.amount)

  const overdue = due.filter((p) => p.daysUntil < 0)
  if (overdue.length > 0) {
    return { kind: 'overdue', key: `overdue:${today}:${idsOf(overdue)}`, payments: overdue, total: sumAmounts(overdue) }
  }

  const dueToday = due.filter((p) => p.daysUntil === 0)
  if (dueToday.length > 0) {
    return { kind: 'due-today', key: `today:${today}:${idsOf(dueToday)}`, payments: dueToday, total: sumAmounts(dueToday) }
  }

  const upcoming = due.filter((p) => p.daysUntil > 0 && p.daysUntil <= windowDays)
  if (upcoming.length > 0) {
    const tier = upcoming[0].daysUntil <= SOON_DAYS ? 'soon' : 'week'
    return {
      kind: 'upcoming',
      key: `upcoming:${today}:${tier}:${idsOf(upcoming)}`,
      tier,
      payments: upcoming,
      total: sumAmounts(upcoming),
      windowDays,
    }
  }

  const recent = findCelebratablePayment(payments, loans, celebratedIds, now)
  if (recent) {
    return {
      kind: 'celebrating',
      key: `celebrate:${recent.payment.id}`,
      payment: recent.payment,
      loan: recent.loan,
      fullyPaid: isFullyPaid(recent.loan),
      remaining: remainingBalance(recent.loan),
      paymentsLeft: monthsLeft(recent.loan),
    }
  }

  const insight = collectInsights(loans, monthlyIncome, now)
    .find(({ key }) => seenInsights[key] === undefined || seenInsights[key] === today)
  if (insight) {
    return { kind: 'insight', key: `insight:${insight.key}`, insightKey: insight.key, insight: insight.insight }
  }

  const hasLoans = tracked.length > 0
  if (!hasLoans || greetingEligible) {
    return { kind: 'greeting', key: `greeting:${today}`, hasLoans }
  }

  const allPaidOff = tracked.every((l) => isFullyPaid(l))
  return { kind: 'relaxed', key: `relaxed:${today}`, next: due[0] ?? null, allPaidOff }
}
