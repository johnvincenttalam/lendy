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

    schedule.push({
      month: i + 1,
      date: payDate,
      payment: Math.round(payment * 100) / 100,
      principal: Math.round(principalPerMonth * 100) / 100,
      interest: Math.round(interestPerMonth * 100) / 100,
    })
  }

  return schedule
}

export function remainingBalance(loan: Loan): number {
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

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
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

// --- Aggregate calculations across all loans ---

export function debtFreeDate(loans: Loan[]): Date | null {
  const active = loans.filter((l) => !isFullyPaid(l))
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
    .filter((l) => !isFullyPaid(l))
    .reduce((sum, l) => sum + l.monthlyPayment, 0)
  return totalMonthly / monthlyIncome
}
