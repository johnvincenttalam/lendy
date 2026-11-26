/** YYYY-MM-DD in the device's own timezone (toISOString would give UTC). */
export function localISODate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** Local midnight of a YYYY-MM-DD day (new Date('YYYY-MM-DD') would give UTC midnight). */
export function parseLocalISODate(s: string): Date {
  const [y, m, d] = s.slice(0, 10).split('-').map(Number)
  return new Date(y, m - 1, d)
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
