import type { Bill, BillPaymentRecord } from './billTypes'

export type MonthlyBillTotal = {
  /** 'YYYY-MM' — stable identity for the month, safe as a React key. */
  key: string
  /** Short month name for the axis, e.g. 'Mar'. */
  label: string
  total: number
  /**
   * True for the month the user is currently living in. Its bills aren't all
   * due yet, so its bar is only ever partial — callers must leave it out of
   * any highest/lowest comparison.
   */
  inProgress: boolean
}

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/**
 * Months since year 0, so arithmetic across a year boundary is plain addition.
 * Derived by slicing the 'YYYY-MM-DD' string rather than parsing it: a bare date
 * string parses as midnight UTC, which is still the previous day — and sometimes
 * the previous month — anywhere west of Greenwich. billUtils.ts carries the same
 * warning for the opposite offset.
 */
function monthIndexOf(isoDate: string): number {
  return Number(isoDate.slice(0, 4)) * 12 + (Number(isoDate.slice(5, 7)) - 1)
}

function keyOf(monthIndex: number): string {
  const year = Math.floor(monthIndex / 12)
  const month = monthIndex % 12
  return `${year}-${String(month + 1).padStart(2, '0')}`
}

/**
 * Total actually paid per month over the recent past, newest last.
 *
 * Built from payment history rather than the bills' scheduled amounts: every bill
 * recurs monthly at a fixed amount, so a projection would be a flat line by
 * construction. The variation the user is looking for lives entirely in what they
 * did or didn't pay.
 *
 * Payments count toward the cycle they covered (`dueDate`), not the day they were
 * recorded (`paidAt`) — settling March's rent on April 2nd is still March's rent,
 * and filing it under April would make one month look cheap and the next
 * expensive, which inverts the comparison the chart exists to show.
 *
 * The window ends at the current month or the last month with a payment,
 * whichever is earlier, so a long-idle tracker doesn't trail off into empty bars.
 * Gaps *between* paid months are kept at zero — a month you skipped is a real
 * result, not missing data.
 */
export function buildMonthlyBillTotals(
  bills: Bill[],
  payments: BillPaymentRecord[],
  monthCount: number,
  reference: Date = new Date(),
): MonthlyBillTotal[] {
  // Archiving withdraws a bill from every other figure in the app, so its
  // history leaves here too.
  const archivedBillIds = new Set(bills.filter((b) => b.archived).map((b) => b.id))
  const currentMonth = reference.getFullYear() * 12 + reference.getMonth()

  const totals = new Map<number, number>()
  for (const payment of payments) {
    if (archivedBillIds.has(payment.billId)) continue
    const month = monthIndexOf(payment.dueDate)
    // Paying ahead shouldn't open a bar for a month that hasn't happened.
    if (month > currentMonth) continue
    totals.set(month, (totals.get(month) ?? 0) + payment.amount)
  }
  if (totals.size === 0) return []

  const paidMonths = [...totals.keys()]
  const last = Math.min(currentMonth, Math.max(...paidMonths))
  const first = Math.max(last - monthCount + 1, Math.min(...paidMonths))

  const result: MonthlyBillTotal[] = []
  for (let month = first; month <= last; month++) {
    result.push({
      key: keyOf(month),
      label: MONTH_LABELS[month % 12],
      total: Math.round((totals.get(month) ?? 0) * 100) / 100,
      inProgress: month === currentMonth,
    })
  }
  return result
}
