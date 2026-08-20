import type { Loan, PaymentBreakdown } from './loanTypes'

// --- Flat/Simple Interest (Philippine lending model) ---

export function totalInterestOverLife(loan: Loan): number {
  return loan.totalAmount * (loan.interestRate / 100) * loan.durationMonths
}

export function totalCostOfLoan(loan: Loan): number {
  return loan.totalAmount + totalInterestOverLife(loan)
}

export function monthlyInterestPortion(loan: Loan): number {
  if (loan.durationMonths === 0) return 0
  return totalInterestOverLife(loan) / loan.durationMonths
}

export function monthlyPrincipalPortion(loan: Loan): number {
  if (loan.durationMonths === 0) return 0
  return loan.totalAmount / loan.durationMonths
}

export function paymentSchedule(loan: Loan): PaymentBreakdown[] {
  const principalPerMonth = monthlyPrincipalPortion(loan)
  const interestPerMonth = monthlyInterestPortion(loan)
  const schedule: PaymentBreakdown[] = []

  for (let i = 0; i < loan.durationMonths; i++) {
    const payDate = new Date(loan.startDate)
    payDate.setMonth(payDate.getMonth() + i)

    const isLast = i === loan.durationMonths - 1
    const payment = isLast
      ? totalCostOfLoan(loan) - loan.monthlyPayment * (loan.durationMonths - 1)
      : loan.monthlyPayment

    const roundedPayment = Math.round(payment * 100) / 100
    const roundedInterest = Math.round(interestPerMonth * 100) / 100
    const principal = isLast
      ? Math.round((roundedPayment - roundedInterest) * 100) / 100
      : Math.round(principalPerMonth * 100) / 100

    schedule.push({
      month: i + 1,
      date: payDate,
      payment: roundedPayment,
      principal,
      interest: roundedInterest,
    })
  }

  return schedule
}

export function remainingBalance(loan: Loan): number {
  if (isFullyPaid(loan)) return 0
  const totalCost = totalCostOfLoan(loan)
  return Math.max(0, totalCost - loan.totalPaid)
}

export function remainingPrincipal(loan: Loan): number {
  const principalPerMonth = monthlyPrincipalPortion(loan)
  return Math.max(0, loan.totalAmount - principalPerMonth * loan.monthsPaid)
}

export function monthsLeft(loan: Loan): number {
  return Math.max(0, loan.durationMonths - loan.monthsPaid)
}

export function progress(loan: Loan): number {
  if (loan.durationMonths === 0) return 0
  return Math.min(1, loan.monthsPaid / loan.durationMonths)
}

export function progressPercent(loan: Loan): number {
  return Math.round(progress(loan) * 100)
}

export function statusColor(loan: Loan): 'green' | 'orange' | 'red' {
  const p = progress(loan)
  if (p > 0.7) return 'green'
  if (p >= 0.3) return 'orange'
  return 'red'
}

export function statusClasses(loan: Loan) {
  const color = statusColor(loan)
  return {
    bg: color === 'green' ? 'bg-emerald-500' : color === 'orange' ? 'bg-brand' : 'bg-red-500',
    bgLight: color === 'green' ? 'bg-emerald-500/15' : color === 'orange' ? 'bg-brand/15' : 'bg-red-500/15',
    text: color === 'green' ? 'text-emerald-500' : color === 'orange' ? 'text-brand' : 'text-red-500',
    badge: color === 'green' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : color === 'orange' ? 'bg-brand/10 text-brand' : 'bg-red-500/10 text-red-500',
  }
}

const currencyFormatter = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

export function formatCurrency(amount: number): string {
  return currencyFormatter.format(amount)
}

/**
 * Split a formatted currency value into its symbol and numeric portion.
 * Lets callers render the ₱ symbol with a font that actually has the glyph
 * (the tabular font used for financial values doesn't) without touching
 * the numeric formatting itself.
 */
export function formatCurrencyParts(amount: number): { symbol: string; amount: string } {
  let symbol = ''
  let rest = ''
  for (const part of currencyFormatter.formatToParts(amount)) {
    if (part.type === 'currency') symbol += part.value
    else rest += part.value
  }
  return { symbol, amount: rest }
}

export function endDate(loan: Loan): string {
  const start = new Date(loan.startDate)
  start.setMonth(start.getMonth() + loan.durationMonths)
  return start.toISOString().split('T')[0]
}

export function isFullyPaid(loan: Loan): boolean {
  return loan.monthsPaid >= loan.durationMonths
}

export function interestPaidSoFar(loan: Loan): number {
  return monthlyInterestPortion(loan) * loan.monthsPaid
}

export function interestRemaining(loan: Loan): number {
  return totalInterestOverLife(loan) - interestPaidSoFar(loan)
}

export function suggestedMonthlyPayment(totalAmount: number, monthlyRate: number, months: number): number {
  if (months <= 0) return 0
  const totalInterest = totalAmount * (monthlyRate / 100) * months
  return (totalAmount + totalInterest) / months
}

/**
 * The monthly payment implied by the loan's own amount, rate and tenure — i.e. the
 * figure whose principal + interest breakdown actually adds up. Rounded to centavos
 * so it can be compared against a stored `monthlyPayment` directly.
 */
export function scheduledMonthlyPayment(loan: Loan): number {
  return Math.round(suggestedMonthlyPayment(loan.totalAmount, loan.interestRate, loan.durationMonths) * 100) / 100
}

/**
 * `monthlyPayment` is entered by hand, so it can drift from the amount/rate/tenure it
 * sits beside — leaving a card that shows a payment its own breakdown contradicts.
 * Returns the scheduled figure when the stored one is off by more than a centavo,
 * or null when they agree.
 */
export function offScheduleAmount(loan: Loan): number | null {
  if (loan.durationMonths <= 0) return null
  const scheduled = scheduledMonthlyPayment(loan)
  if (scheduled <= 0) return null
  return Math.abs(scheduled - loan.monthlyPayment) > 0.005 ? scheduled : null
}

// --- Aggregate calculations across all loans ---

export function debtFreeDate(loans: Loan[]): Date | null {
  const active = loans.filter((l) => !l.archived && !isFullyPaid(l))
  if (active.length === 0) return null

  let latest = new Date(0)
  for (const loan of active) {
    const end = new Date(loan.startDate)
    end.setMonth(end.getMonth() + loan.durationMonths)
    if (end > latest) latest = end
  }
  return latest
}

export function totalInterestAllLoans(loans: Loan[]): number {
  return loans.reduce((sum, l) => sum + totalInterestOverLife(l), 0)
}

export function totalInterestPaidAllLoans(loans: Loan[]): number {
  return loans.reduce((sum, l) => sum + interestPaidSoFar(l), 0)
}

export function debtPayoffTimeline(loans: Loan[]): Array<{ date: Date; balance: number }> {
  const active = loans.filter((l) => !isFullyPaid(l))
  if (active.length === 0) return []

  const now = new Date()
  const startMonth = new Date(now.getFullYear(), now.getMonth(), 1)

  // Find max months remaining across all loans
  let maxMonths = 0
  for (const loan of active) {
    const start = new Date(loan.startDate)
    const loanEnd = new Date(start)
    loanEnd.setMonth(loanEnd.getMonth() + loan.durationMonths)
    const monthsFromNow = (loanEnd.getFullYear() - now.getFullYear()) * 12 + (loanEnd.getMonth() - now.getMonth())
    if (monthsFromNow > maxMonths) maxMonths = monthsFromNow
  }

  const timeline: Array<{ date: Date; balance: number }> = []

  for (let m = 0; m <= maxMonths; m++) {
    const date = new Date(startMonth)
    date.setMonth(date.getMonth() + m)

    let totalBalance = 0
    for (const loan of active) {
      const start = new Date(loan.startDate)
      const monthsSinceStart = (date.getFullYear() - start.getFullYear()) * 12 + (date.getMonth() - start.getMonth())
      const effectivePaid = Math.min(Math.max(monthsSinceStart, loan.monthsPaid), loan.durationMonths)
      const remaining = totalCostOfLoan(loan) - loan.monthlyPayment * effectivePaid
      totalBalance += Math.max(0, remaining)
    }

    timeline.push({ date, balance: totalBalance })
  }

  return timeline
}

export function debtToIncomeRatio(loans: Loan[], monthlyIncome: number): number {
  if (monthlyIncome <= 0) return 0
  const totalMonthly = loans
    .filter((l) => !l.archived && !isFullyPaid(l))
    .reduce((sum, l) => sum + l.monthlyPayment, 0)
  return totalMonthly / monthlyIncome
}

// --- Overdue detection ---

/**
 * Get the next unpaid payment's due date for a loan
 */
export function nextDueDate(loan: Loan): Date | null {
  if (isFullyPaid(loan)) return null
  const schedule = paymentSchedule(loan)
  const nextPayment = schedule[loan.monthsPaid]
  return nextPayment?.date ?? null
}

/**
 * Check if a loan has an overdue payment (due date has passed and not paid)
 */
export function isOverdue(loan: Loan): boolean {
  if (isFullyPaid(loan) || loan.archived) return false
  const dueDate = nextDueDate(loan)
  if (!dueDate) return false

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const due = new Date(dueDate)
  due.setHours(0, 0, 0, 0)

  return due < today
}

/**
 * Get the number of days a payment is overdue (0 if not overdue)
 */
export function daysOverdue(loan: Loan): number {
  if (!isOverdue(loan)) return 0
  const dueDate = nextDueDate(loan)
  if (!dueDate) return 0

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const due = new Date(dueDate)
  due.setHours(0, 0, 0, 0)

  const diffTime = today.getTime() - due.getTime()
  return Math.floor(diffTime / (1000 * 60 * 60 * 24))
}

/**
 * Get all overdue loans from a list
 */
export function getOverdueLoans(loans: Loan[]): Loan[] {
  return loans.filter((l) => !l.archived && isOverdue(l))
}

/**
 * Get total overdue amount across all loans
 */
export function totalOverdueAmount(loans: Loan[]): number {
  return getOverdueLoans(loans).reduce((sum, l) => sum + l.monthlyPayment, 0)
}

// --- Upcoming payments ---

export type UpcomingPayments = {
  count: number
  amount: number
  from: Date
  to: Date
}

/**
 * The half-month bucket (1–15 / 16–end) a date falls into, as its start date —
 * matches the grouping used by the Calendar page's schedule view.
 */
function halfMonthStart(date: Date): Date {
  const half = date.getDate() <= 15 ? 1 : 16
  return new Date(date.getFullYear(), date.getMonth(), half)
}

/**
 * Summarize payments due (not yet overdue) in the nearest half-month bucket
 * that has any — today's bucket if something's due there, otherwise the
 * next one with payments — for the homepage "what's coming up" hint.
 */
export function upcomingPayments(loans: Loan[]): UpcomingPayments | null {
  const entries: { date: Date; amount: number }[] = []

  for (const loan of loans) {
    if (loan.archived || isFullyPaid(loan) || isOverdue(loan)) continue
    const due = nextDueDate(loan)
    if (!due) continue
    due.setHours(0, 0, 0, 0)
    entries.push({ date: due, amount: loan.monthlyPayment })
  }

  if (entries.length === 0) return null

  const nearestBucket = Math.min(...entries.map((e) => halfMonthStart(e.date).getTime()))
  const inBucket = entries.filter((e) => halfMonthStart(e.date).getTime() === nearestBucket)
  const amount = inBucket.reduce((sum, e) => sum + e.amount, 0)
  const times = inBucket.map((e) => e.date.getTime())

  return {
    count: inBucket.length,
    amount,
    from: new Date(Math.min(...times)),
    to: new Date(Math.max(...times)),
  }
}
