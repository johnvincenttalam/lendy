/**
 * `months` calendar months after `date`, keeping its day and time of day but
 * never spilling into the following month: Jan 31 + 1 month is Feb 28 (29 in
 * a leap year), not Mar 3 as `Date#setMonth` gives. Always count from the
 * original date (start + n) rather than chaining, so a short month's clamp
 * doesn't carry over: Jan 31 + 2 months is Mar 31.
 */
export function addMonthsClamped(date: Date, months: number): Date {
  const out = new Date(date)
  const day = out.getDate()
  out.setDate(1)
  out.setMonth(out.getMonth() + months)
  const lastDay = new Date(out.getFullYear(), out.getMonth() + 1, 0).getDate()
  out.setDate(Math.min(day, lastDay))
  return out
}
