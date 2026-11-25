import { useLoanStore } from '../features/loans/loanStore'
import { useBillStore } from '../features/bills/billStore'
import { useSavingsStore } from '../features/savings/savingsStore'
import { useIncomeStore } from '../features/finance/incomeStore'
import { usePrivateFolderStore } from '../features/privateFolder/privateFolderStore'
import { parseFolderBackup } from '../features/privateFolder/privateFolderUtils'
import { showToast } from '../components/toastEvents'
import { SCHEMA_VERSION, backupVersion, migrateSnapshot } from '../features/backup/schema'
import type { Snapshot } from '../features/backup/schema'
import { useLastBackupStore } from '../features/backup/lastBackupStore'

export function exportAllData(): string {
  const { loans, payments } = useLoanStore.getState()
  const { monthlyIncome } = useIncomeStore.getState()
  const { bills, billPayments } = useBillStore.getState()
  const { goals, transactions } = useSavingsStore.getState()
  // Private loans travel with their folder's name and PIN, so a restore
  // brings them back locked rather than open.
  const { name, pinHash, recoveryHash } = usePrivateFolderStore.getState()
  const privateFolder = name !== null ? { name, pinHash, recoveryHash } : undefined
  return JSON.stringify({
    schemaVersion: SCHEMA_VERSION,
    loans,
    payments,
    monthlyIncome,
    bills,
    billPayments,
    savingsGoals: goals,
    savingsTransactions: transactions,
    privateFolder,
    exportedAt: new Date().toISOString(),
  }, null, 2)
}

export type BackupCounts = { loans: number; bills: number; savingsGoals: number }

export type BackupCheck =
  | { ok: true; counts: BackupCounts }
  | { ok: false; reason: 'invalid' | 'newer' }

/** Whether a file can be restored here, checked before asking the user to confirm. */
export function checkBackup(json: string): BackupCheck {
  const data = parseSnapshot(json)
  if (!data) return { ok: false, reason: 'invalid' }
  if (backupVersion(data) > SCHEMA_VERSION) return { ok: false, reason: 'newer' }
  const counts = parseBackupCounts(json)
  return counts ? { ok: true, counts } : { ok: false, reason: 'invalid' }
}

function parseSnapshot(json: string): Snapshot | null {
  try {
    const data: unknown = JSON.parse(json)
    if (!data || typeof data !== 'object' || !Array.isArray((data as Snapshot).loans)) return null
    return data as Snapshot
  } catch {
    return null
  }
}

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
  const raw = parseSnapshot(json)
  if (!raw) return false
  // A file from a newer version could hold data this one would misread.
  const version = backupVersion(raw)
  if (version > SCHEMA_VERSION) return false
  // Older files are upgraded with the same steps as device storage.
  const data = migrateSnapshot(raw, version)
  json = JSON.stringify(data)

  const loanOk = useLoanStore.getState().importBackup(json)
  useBillStore.getState().importBackup(json)
  useSavingsStore.getState().importBackup(json)
  // Older backups may still carry moneyEntries from the removed Money page; they're ignored.
  const folder = parseFolderBackup(data)
  if (folder) usePrivateFolderStore.getState().restoreBackup(folder)

  if (loanOk) {
    // What's on the device now matches a file the user has.
    useLastBackupStore.getState().markBackedUp()
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
