import type { Loan, PaymentRecord } from '../loans/loanTypes'
import type { Bill, BillPaymentRecord } from '../bills/billTypes'
import type { SavingsGoal } from '../savings/savingsTypes'
import type { MoneyCategory, MoneyEntry } from '../money/moneyTypes'
import {
  formatCurrency, remainingBalance, totalCostOfLoan, monthsLeft, nextDueDate, daysOverdue,
  endDate, isFullyPaid, isTracked, debtFreeDate,
} from '../loans/loanUtils'
import { isBillOverdue, billDaysOverdue, paidForCycle } from '../bills/billUtils'
import { progressPercent } from '../savings/savingsUtils'
import {
  allCategories, resolveCategory, localISODate, monthKeyOf, shiftMonth, entriesForMonth,
  monthTotals, expenseBreakdown,
} from '../money/moneyUtils'
import { folderLabel } from '../privateFolder/privateFolderUtils'

/** ~6,000 tokens — well under a free-tier model's per-minute limit. */
export const SUMMARY_CHAR_BUDGET = 24_000

const MONTHS_OF_HISTORY = 12
const ENTRY_WINDOWS = [60, 30, 15, 0]

export type SummaryInput = {
  loans: Loan[]
  payments: PaymentRecord[]
  bills: Bill[]
  billPayments: BillPaymentRecord[]
  goals: SavingsGoal[]
  moneyEntries: MoneyEntry[]
  moneyCategories: MoneyCategory[]
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

function moneySection(input: SummaryInput, now: Date, months: number, windowDays: number): string[] {
  const categories = allCategories(input.moneyCategories)
  const nameOf = (categoryId: string, type: MoneyEntry['type']) => resolveCategory(categories, { categoryId, type }).name
  const lines = ['MONEY (income and expenses)']
  if (input.monthlyIncome > 0) lines.push(`Monthly income setting: ${money(input.monthlyIncome)}`)

  const thisMonth = monthKeyOf(localISODate(now))
  for (let i = 0; i < months; i++) {
    const key = shiftMonth(thisMonth, -i)
    const inMonth = entriesForMonth(input.moneyEntries, key)
    if (inMonth.length === 0) continue
    const { income, expenses, net } = monthTotals(inMonth)
    const byCategory = expenseBreakdown(inMonth).map((c) => `${nameOf(c.categoryId, 'expense')} ${money(c.total)}`)
    lines.push(`${key}: income ${money(income)}, expenses ${money(expenses)}, net ${money(net)}` +
      (byCategory.length ? `; expenses by category: ${byCategory.join(', ')}` : ''))
  }

  if (windowDays > 0) {
    const from = new Date(now)
    from.setDate(from.getDate() - windowDays)
    const cutoff = localISODate(from)
    const recent = input.moneyEntries
      .filter((e) => e.date >= cutoff)
      .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
    if (recent.length > 0) {
      lines.push(`Individual entries, last ${windowDays} days (newest first):`)
      for (const e of recent) {
        lines.push(`- ${e.date} ${e.type} ${nameOf(e.categoryId, e.type)} ${money(e.amount)}${e.note ? ` — ${e.note}` : ''}`)
      }
    }
  }
  if (lines.length === 1) lines.push('- no entries')
  return lines
}

/**
 * Everything Ollie may know, as plain text with every figure already
 * worked out by the app — so the model only has to find and phrase.
 * Private loans (and the folder's name) appear only with `includePrivate`.
 */
export function buildSummary(input: SummaryInput, now: Date): string {
  const fixed = [
    `Today: ${localISODate(now)}. Currency: Philippine peso (₱). Dates are YYYY-MM-DD.`,
    '',
    ...loanSections(input),
    '',
    ...billSection(input.bills, input.billPayments),
    '',
    ...savingsSection(input.goals),
    '',
  ].join('\n')

  // Trim money history to fit: oldest months first, then the entries window.
  let months = MONTHS_OF_HISTORY
  let windowIndex = 0
  for (;;) {
    const text = `${fixed}\n${moneySection(input, now, months, ENTRY_WINDOWS[windowIndex]).join('\n')}`
    if (text.length <= SUMMARY_CHAR_BUDGET) return text
    if (months > 1) months -= 1
    else if (windowIndex < ENTRY_WINDOWS.length - 1) windowIndex += 1
    else if (months > 0) months = 0
    else return text // only loans, bills and goals left — never cut those
  }
}
