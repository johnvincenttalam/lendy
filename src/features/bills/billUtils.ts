import type { Bill } from './billTypes'
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
