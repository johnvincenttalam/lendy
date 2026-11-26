import type { Loan, PaymentRecord } from '../loans/loanTypes'
import type { Bill, BillPaymentRecord } from '../bills/billTypes'
import type { SavingsGoal, SavingsTransaction } from '../savings/savingsTypes'

/** Everything Ollie stores about money, in pesos, in the shapes the app uses. */
export type DataSnapshot = {
  loans: Loan[]
  payments: PaymentRecord[]
  monthlyIncome: number
  bills: Bill[]
  billPayments: BillPaymentRecord[]
  savingsGoals: SavingsGoal[]
  savingsTransactions: SavingsTransaction[]
}

export type Field = keyof DataSnapshot
export type RecordField = Exclude<Field, 'monthlyIncome'>

export const RECORD_FIELDS: readonly RecordField[] = [
  'loans', 'payments', 'bills', 'billPayments', 'savingsGoals', 'savingsTransactions',
]

/** One save: for each field it touches, the value after and before the change. */
export type Change = { [F in Field]?: { next: DataSnapshot[F]; prev: DataSnapshot[F] } }

export function emptySnapshot(): DataSnapshot {
  return { loans: [], payments: [], monthlyIncome: 0, bills: [], billPayments: [], savingsGoals: [], savingsTransactions: [] }
}

/** Records that belong to another record, and the field that points at it. */
export const PARENT_LINKS = {
  payments: { key: 'loanId', parent: 'loans' },
  billPayments: { key: 'billId', parent: 'bills' },
  savingsTransactions: { key: 'goalId', parent: 'savingsGoals' },
} as const
