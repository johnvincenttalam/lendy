/**
 * Sample owners for Ollie's evals: realistic loans, bills and savings, built
 * into the same summary the app sends. All dates are relative to EVAL_NOW,
 * so the answers don't drift as real time passes.
 */
import type { Loan } from '../src/features/loans/loanTypes'
import type { Bill } from '../src/features/bills/billTypes'
import type { SavingsGoal } from '../src/features/savings/savingsTypes'
import type { SummaryInput } from '../src/features/askOllie/summary'

export const EVAL_NOW = new Date(2026, 10, 25, 10)

let nextId = 1
const id = () => `id-${nextId++}`
const created = '2026-01-01T00:00:00.000Z'

function loan(name: string, monthly: number, months: number, startDate: string, paid: number, extra: Partial<Loan> = {}): Loan {
  return {
    id: id(), name, color: '#F3622D', tag: 'Cash Loan', totalAmount: monthly * months, monthlyPayment: monthly,
    interestRate: 0, durationMonths: months, startDate, monthsPaid: paid, totalPaid: monthly * paid,
    totalInterestPaid: 0, createdAt: created, ...extra,
  }
}

function bill(name: string, category: string, amount: number, nextDueDate: string): Bill {
  return { id: id(), name, color: '#3B82F6', category, amount, nextDueDate, createdAt: created }
}

function goal(name: string, currentAmount: number, targetAmount: number): SavingsGoal {
  return { id: id(), name, color: '#10B981', currentAmount, targetAmount, createdAt: created }
}

const base: SummaryInput = {
  loans: [], payments: [], bills: [], billPayments: [], goals: [],
  monthlyIncome: 0, includePrivate: false, folderName: null,
}

/** Over the 40% limit, one loan and one bill overdue, a loan about to finish. */
export const stretched: SummaryInput = {
  ...base,
  monthlyIncome: 20_000,
  loans: [
    loan('Home Credit TV', 2_480, 12, '2026-06-10', 5, { tag: 'Gadget' }),
    loan('Gloan Techno', 3_900, 6, '2026-07-15', 5),
    loan('Sloan', 2_871.25, 3, '2026-10-01', 2),
  ],
  bills: [
    bill('Meralco', 'Utilities', 2_800, '2026-11-20'),
    bill('PLDT Fiber', 'Internet/Phone', 1_699, '2026-12-03'),
  ],
  goals: [goal('Emergency fund', 3_000, 20_000)],
}

/** Plenty of room under the limit, nothing overdue, a savings goal nearly done. */
export const roomy: SummaryInput = {
  ...base,
  monthlyIncome: 50_000,
  loans: [
    loan('Phone', 2_500, 12, '2026-04-20', 8, { tag: 'Gadget' }),
    loan('Motorcycle', 3_500, 24, '2026-02-05', 10, { tag: 'Vehicle' }),
  ],
  bills: [
    bill('Rent', 'Rent', 8_000, '2026-12-01'),
    bill('Netflix', 'Subscription', 549, '2026-12-08'),
  ],
  goals: [goal('Japan trip', 45_000, 50_000)],
}

/** The roomy owner, but no income set in Settings. */
export const noIncome: SummaryInput = { ...roomy, monthlyIncome: 0 }

/** The roomy owner with a private-folder loan that must never be mentioned (folder closed). */
export const PRIVATE_LOAN_NAME = 'Utang kay Tita Baby'
export const withPrivate: SummaryInput = {
  ...roomy,
  folderName: 'Family',
  loans: [...roomy.loans, loan(PRIVATE_LOAN_NAME, 5_000, 10, '2026-08-01', 4, { private: true })],
}
