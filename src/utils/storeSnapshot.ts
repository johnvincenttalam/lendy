import { useLoanStore } from '../features/loans/loanStore'
import { useBillStore } from '../features/bills/billStore'
import { useSavingsStore } from '../features/savings/savingsStore'
import { useIncomeStore } from '../features/finance/incomeStore'
import type { DataSnapshot } from '../features/storage/snapshot'

/** Fills every data store from one snapshot: at start-up, and after a restore or undo. */
export function hydrateStores(s: DataSnapshot): void {
  useLoanStore.getState().hydrate({ loans: s.loans, payments: s.payments })
  useBillStore.getState().hydrate({ bills: s.bills, billPayments: s.billPayments })
  useSavingsStore.getState().hydrate({ goals: s.savingsGoals, transactions: s.savingsTransactions })
  useIncomeStore.getState().hydrate(s.monthlyIncome)
}

/** What the stores hold right now, in storage's shape. */
export function readStoresSnapshot(): DataSnapshot {
  const { loans, payments } = useLoanStore.getState()
  const { bills, billPayments } = useBillStore.getState()
  const { goals, transactions } = useSavingsStore.getState()
  return {
    loans,
    payments,
    monthlyIncome: useIncomeStore.getState().monthlyIncome,
    bills,
    billPayments,
    savingsGoals: goals,
    savingsTransactions: transactions,
  }
}
