import { useLoanStore } from '../features/loans/loanStore'
import { useBillStore } from '../features/bills/billStore'
import { useSavingsStore } from '../features/savings/savingsStore'
import { useIncomeStore } from '../features/finance/incomeStore'
import { showToast } from '../components/Toast'

export function exportAllData(): string {
  const { loans, payments } = useLoanStore.getState()
  const { monthlyIncome } = useIncomeStore.getState()
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

  if (loanOk) {
    const counts = parseBackupCounts(json)
    if (counts) showToast(describeRestoredCounts(counts))
  }

  return loanOk
}

function describeCount(n: number, singular: string): string {
  return `${n} ${n === 1 ? singular : `${singular}s`}`
}

function describeRestoredCounts(counts: BackupCounts): string {
  const parts: string[] = []
  if (counts.loans > 0) parts.push(describeCount(counts.loans, 'loan'))
  if (counts.bills > 0) parts.push(describeCount(counts.bills, 'bill'))
  if (counts.savingsGoals > 0) parts.push(describeCount(counts.savingsGoals, 'savings goal'))
  const text = parts.length > 0 ? parts.join(', ') : 'No data'
  return `${text} restored`
}
