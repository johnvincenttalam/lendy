import { useLoanStore } from '../features/loans/loanStore'
import { useBillStore } from '../features/bills/billStore'
import { useSavingsStore } from '../features/savings/savingsStore'

export function exportAllData(): string {
  const { loans, payments, monthlyIncome } = useLoanStore.getState()
  const { bills, billPayments } = useBillStore.getState()
  const { goals, transactions } = useSavingsStore.getState()
  return JSON.stringify({
    loans,
    payments,
    monthlyIncome,
    bills,
    billPayments,
    savingsGoals: goals,
    savingsTransactions: transactions,
    exportedAt: new Date().toISOString(),
  }, null, 2)
}

export type BackupCounts = { loans: number; bills: number; savingsGoals: number }

export function parseBackupCounts(json: string): BackupCounts | null {
  try {
    const data = JSON.parse(json)
    if (!Array.isArray(data.loans)) return null
    return {
      loans: data.loans.length,
      bills: Array.isArray(data.bills) ? data.bills.length : 0,
      savingsGoals: Array.isArray(data.savingsGoals) ? data.savingsGoals.length : 0,
    }
  } catch {
    return null
  }
}

export function importAllData(json: string): boolean {
  let data: unknown
  try {
    data = JSON.parse(json)
  } catch {
    return false
  }
  if (!data || typeof data !== 'object' || !Array.isArray((data as { loans?: unknown }).loans)) return false

  const loanOk = useLoanStore.getState().importBackup(json)
  useBillStore.getState().importBackup(json)
  useSavingsStore.getState().importBackup(json)
  return loanOk
}
