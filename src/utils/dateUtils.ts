// Date utility functions

/**
 * Format date as ISO string (YYYY-MM-DD)
 */
export function toISODate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toISOString().split('T')[0]
}

/**
 * Format date for display (e.g., "Apr 7, 2026")
 */
export function formatDate(date: Date | string, options?: Intl.DateTimeFormatOptions): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('en-US', options ?? { day: 'numeric', month: 'short', year: 'numeric' })
}

/**
 * Format date short (e.g., "Apr 7")
 */
export function formatDateShort(date: Date | string): string {
  return formatDate(date, { day: 'numeric', month: 'short' })
}

/**
 * Get start of day (midnight)
 */
export function startOfDay(date: Date | string): Date {
  const d = typeof date === 'string' ? new Date(date) : new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

/**
 * Get today at midnight
 */
export function today(): Date {
  return startOfDay(new Date())
}

/**
 * Calculate days between two dates
 */
export function daysBetween(from: Date | string, to: Date | string): number {
  const fromDate = startOfDay(from)
  const toDate = startOfDay(to)
  const diffTime = toDate.getTime() - fromDate.getTime()
  return Math.floor(diffTime / (1000 * 60 * 60 * 24))
}

/**
 * Check if date is today
 */
export function isToday(date: Date | string): boolean {
  return toISODate(date) === toISODate(new Date())
}

/**
 * Add months to a date
 */
export function addMonths(date: Date | string, months: number): Date {
  const d = typeof date === 'string' ? new Date(date) : new Date(date)
  d.setMonth(d.getMonth() + months)
  return d
}

/**
 * Get days in month
 */
export function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate()
}

/**
 * Get first day of month (0 = Sunday)
 */
export function getFirstDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 1).getDay()
}
