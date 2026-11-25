import type { Loan, PaymentRecord } from '../loans/loanTypes'
import type { Bill, BillPaymentRecord } from '../bills/billTypes'
import type { SavingsGoal } from '../savings/savingsTypes'
import {
  formatCurrency, remainingBalance, totalCostOfLoan, monthsLeft, nextDueDate, daysOverdue,
  endDate, isFullyPaid, isTracked, debtFreeDate, debtToIncomeRatio,
} from '../loans/loanUtils'
import { isBillOverdue, billDaysOverdue, paidForCycle } from '../bills/billUtils'
import { progressPercent } from '../savings/savingsUtils'
import { folderLabel } from '../privateFolder/privateFolderUtils'
import { HIGH_DTI, localISODate } from '../ollie/ollieUtils'

export type SummaryInput = {
  loans: Loan[]
  payments: PaymentRecord[]
  bills: Bill[]
  billPayments: BillPaymentRecord[]
  goals: SavingsGoal[]
  monthlyIncome: number
  /** True only when the chat was opened from inside the private folder. */
  includePrivate: boolean
  folderName: string | null
}

const money = formatCurrency

function monthYear(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

function loanLine(loan: Loan): string {
  const status = loan.archived ? 'archived' : isFullyPaid(loan) ? 'paid off' : daysOverdue(loan) > 0 ? 'overdue' : 'active'
  const remaining = remainingBalance(loan)
  const cost = totalCostOfLoan(loan)
  const parts = [
    `- ${loan.name}${loan.tag ? ` [${loan.tag}]` : ''} (${status})`,
    `borrowed ${money(loan.totalAmount)}`,
    `monthly ${money(loan.monthlyPayment)}`,
    `interest ${loan.interestRate}%/month`,
    `payments ${loan.monthsPaid} of ${loan.durationMonths} (${monthsLeft(loan)} left)`,
    `remaining ${money(remaining)}`,
    `paid so far ${money(Math.max(0, cost - remaining))}`,
    `total cost ${money(cost)}`,
  ]
  const due = isFullyPaid(loan) ? null : nextDueDate(loan)
  if (due) parts.push(`next due ${localISODate(due)}`)
  const late = daysOverdue(loan)
  if (late > 0 && !loan.archived) parts.push(`${late} days overdue`)
  parts.push(`ends ${endDate(loan)}`)
  return parts.join(', ')
}

function loanSections(input: SummaryInput): string[] {
  const regular = input.loans.filter((l) => !l.private)
  const secret = input.includePrivate ? input.loans.filter((l) => l.private) : []
  const tracked = input.loans.filter(isTracked)
  const lines: string[] = ['LOANS']
  if (regular.length === 0) lines.push('- none')
  lines.push(...regular.map(loanLine))

  const leftToPay = tracked.reduce((sum, l) => sum + remainingBalance(l), 0)
  const monthly = tracked.filter((l) => !isFullyPaid(l)).reduce((sum, l) => sum + l.monthlyPayment, 0)
  const freeOn = debtFreeDate(input.loans)
  lines.push(
    `Total left to pay (regular loans): ${money(leftToPay)}`,
    `Total monthly loan payments (regular loans): ${money(monthly)}`,
    `Debt-free date (regular loans): ${freeOn ? monthYear(freeOn) : 'no active loans'}`,
  )
  // Ready-made figures for "should I take another loan?" — Ollie mustn't do the maths.
  if (input.monthlyIncome > 0) {
    const share = Math.round(debtToIncomeRatio(input.loans, input.monthlyIncome) * 100)
    lines.push(`Monthly loan payments as a share of monthly income (regular loans): ${share}%`)
  }
  const overdue = tracked.filter((l) => !isFullyPaid(l) && daysOverdue(l) > 0)
  lines.push(`Overdue regular loans: ${overdue.length ? `${overdue.length} (${overdue.map((l) => l.name).join(', ')})` : 'none'}`)

  if (secret.length > 0) {
    lines.push('', `PRIVATE FOLDER "${folderLabel(input.folderName)}" (shown only because the folder is open)`)
    lines.push(...secret.map(loanLine))
    const open = secret.filter((l) => !l.archived)
    lines.push(
      `Private folder left to pay: ${money(open.reduce((sum, l) => sum + remainingBalance(l), 0))}`,
      `Private folder monthly payments: ${money(open.filter((l) => !isFullyPaid(l)).reduce((sum, l) => sum + l.monthlyPayment, 0))}`,
    )
  }

  // Rankings cover every unfinished, unarchived loan listed above.
  const ranked = [...regular, ...secret]
    .filter((l) => !l.archived && !isFullyPaid(l))
    .sort((a, b) => remainingBalance(b) - remainingBalance(a))
  if (ranked.length > 0) {
    const largest = ranked[0]
    const smallest = ranked[ranked.length - 1]
    lines.push(
      `Largest remaining balance: ${largest.name} (${money(remainingBalance(largest))})`,
      `Smallest remaining balance: ${smallest.name} (${money(remainingBalance(smallest))})`,
    )
  }
  return lines
}

/**
 * Comparisons a friend would make — headroom, what frees up next — worked out here so Ollie can give an honest read
 * without doing the maths. Regular loans only, like the totals above.
 */
function quickReadSection(input: SummaryInput): string[] {
  const lines = ['QUICK READ (worked out by the app)']
  const active = input.loans.filter((l) => isTracked(l) && !isFullyPaid(l))
  const monthly = active.reduce((sum, l) => sum + l.monthlyPayment, 0)
  const income = input.monthlyIncome
  const limitPercent = Math.round(HIGH_DTI * 100)

  if (income > 0) {
    const limit = income * HIGH_DTI
    lines.push(`Comfortable limit for monthly loan payments (${limitPercent}% of the ${money(income)} income setting): ${money(limit)}`)
    lines.push(monthly > limit
      ? `Monthly loan payments are over that limit by ${money(monthly - limit)}`
      : `Room left under that limit: ${money(limit - monthly)} a month`)
  } else {
    lines.push('No monthly income is set in Settings, so there is no comfortable limit to compare against.')
  }

  if (active.length > 0) {
    const firstEnd = active.map(endDate).sort()[0]
    const finishing = active.filter((l) => endDate(l) === firstEnd)
    const freed = finishing.reduce((sum, l) => sum + l.monthlyPayment, 0)
    lines.push(`Next loan to finish: ${finishing.map((l) => l.name).join(' and ')} on ${firstEnd}, freeing ${money(freed)} a month (monthly loan payments after that: ${money(monthly - freed)})`)
  }

  const overdueBills = input.bills.filter(isBillOverdue)
  lines.push(`Overdue bills: ${overdueBills.length ? `${overdueBills.length} (${overdueBills.map((b) => b.name).join(', ')})` : 'none'}`)

  return lines
}

function billSection(bills: Bill[], payments: BillPaymentRecord[]): string[] {
  const lines = ['BILLS']
  if (bills.length === 0) lines.push('- none')
  for (const bill of bills) {
    const parts = [
      `- ${bill.name} (${bill.archived ? 'archived' : bill.category})`,
      `amount ${money(bill.amount)}`,
      `next due ${bill.nextDueDate}`,
      `paid this cycle ${money(paidForCycle(bill, payments))}`,
    ]
    if (isBillOverdue(bill)) parts.push(`${billDaysOverdue(bill)} days overdue`)
    lines.push(parts.join(', '))
  }
  const total = bills.filter((b) => !b.archived).reduce((sum, b) => sum + b.amount, 0)
  lines.push(`Total of active bills: ${money(total)}`)
  return lines
}

function savingsSection(goals: SavingsGoal[]): string[] {
  const lines = ['SAVINGS GOALS']
  if (goals.length === 0) lines.push('- none')
  for (const goal of goals) {
    lines.push([
      `- ${goal.name}${goal.archived ? ' (archived)' : ''}`,
      `saved ${money(goal.currentAmount)}`,
      `target ${money(goal.targetAmount)}`,
      `${progressPercent(goal)}% reached`,
      `${money(Math.max(0, goal.targetAmount - goal.currentAmount))} to go`,
    ].join(', '))
  }
  const saved = goals.filter((g) => !g.archived).reduce((sum, g) => sum + g.currentAmount, 0)
  lines.push(`Total saved (active goals): ${money(saved)}`)
  return lines
}

/**
 * Everything Ollie may know, as plain text with every figure already
 * worked out by the app — so the model only has to find and phrase.
 * Private loans (and the folder's name) appear only with `includePrivate`.
 */
export function buildSummary(input: SummaryInput, now: Date): string {
  return [
    `Today: ${localISODate(now)}. Currency: Philippine peso (₱). Dates are YYYY-MM-DD.`,
    '',
    ...loanSections(input),
    '',
    ...quickReadSection(input),
    '',
    ...billSection(input.bills, input.billPayments),
    '',
    ...savingsSection(input.goals),
  ].join('\n')
}
