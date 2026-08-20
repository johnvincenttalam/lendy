import type { Bill, BillPaymentRecord } from './billTypes'
import { getDaysInMonth, today, daysBetween, startOfDay } from '../../utils/dateUtils'

/**
 * Clamps a day-of-month to the month's actual length, returning a UTC-midnight Date.
 * Uses Date.UTC() (not local-time constructor) to ensure .toISOString() serialization
 * is correct across timezones, especially positive offsets like Philippines (UTC+8).
 * Note: Returns UTC-midnight Date, unlike dateUtils.today()/startOfDay() which return
 * local-midnight. Do not mix with local-midnight comparisons without conversion.
 */
function clampToMonth(year: number, month: number, day: number): Date {
  const lastDay = getDaysInMonth(year, month)
  return new Date(Date.UTC(year, month, Math.min(day, lastDay)))
}

/**
 * Nearest occurrence of `dueDay` on/after `from`, clamped to the month's
 * actual last day (e.g. day 31 in February -> Feb 28/29).
 * Returns a UTC-midnight Date (for correct .toISOString() serialization),
 * not a local-midnight Date like dateUtils.today()/startOfDay().
 */
export function nextOccurrenceOfDay(dueDay: number, from: Date): Date {
  const candidate = clampToMonth(from.getFullYear(), from.getMonth(), dueDay)
  if (candidate >= startOfDay(from)) return candidate
  return clampToMonth(from.getFullYear(), from.getMonth() + 1, dueDay)
}

/**
 * Advances a due date by one month, keeping the same day-of-month
 * (clamped to the target month's length) rather than drifting to
 * whenever the bill happened to be paid.
 */
export function advanceDueDate(current: string): string {
  const d = new Date(current)
  const next = clampToMonth(d.getFullYear(), d.getMonth() + 1, d.getDate())
  return next.toISOString().split('T')[0]
}

export function isBillOverdue(bill: Bill): boolean {
  if (bill.archived) return false
  return startOfDay(new Date(bill.nextDueDate)) < today()
}

export function billDaysOverdue(bill: Bill): number {
  if (!isBillOverdue(bill)) return 0
  return daysBetween(bill.nextDueDate, today())
}

// --- Per-cycle payment tracking ---
//
// A cycle's settled amount is derived from the payment records themselves rather
// than stored on the Bill: every BillPaymentRecord already carries the `dueDate`
// of the cycle it covered, so the records for `bill.nextDueDate` are exactly the
// payments made against the cycle currently due. Nothing to migrate — records
// from before partial payments existed all point at cycles already advanced past,
// so they contribute 0 to the open cycle.

/** Total already paid toward the cycle the bill is currently sitting on. */
export function paidForCycle(bill: Bill, payments: BillPaymentRecord[]): number {
  const total = payments
    .filter((p) => p.billId === bill.id && p.dueDate === bill.nextDueDate)
    .reduce((sum, p) => sum + p.amount, 0)
  return Math.round(total * 100) / 100
}

/** What's still owed on the current cycle. Never negative, even if overpaid. */
export function remainingForCycle(bill: Bill, payments: BillPaymentRecord[]): number {
  return Math.max(0, Math.round((bill.amount - paidForCycle(bill, payments)) * 100) / 100)
}

/** True when the cycle has been paid into but not yet covered. */
export function isPartiallyPaid(bill: Bill, payments: BillPaymentRecord[]): boolean {
  const paid = paidForCycle(bill, payments)
  return paid > 0 && paid < bill.amount
}

/** Fraction of the current cycle settled, 0–1. */
export function cycleProgress(bill: Bill, payments: BillPaymentRecord[]): number {
  if (bill.amount <= 0) return 0
  return Math.min(1, paidForCycle(bill, payments) / bill.amount)
}
