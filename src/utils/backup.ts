import { useLoanStore } from '../features/loans/loanStore'
import { useBillStore } from '../features/bills/billStore'
import { useSavingsStore } from '../features/savings/savingsStore'
import { useIncomeStore } from '../features/finance/incomeStore'
import { usePrivateFolderStore } from '../features/privateFolder/privateFolderStore'
import { showToast } from '../components/toastEvents'
import { SCHEMA_VERSION } from '../features/backup/schema'
import { writeRestore, undoRestore, readSafetyCopy } from '../features/backup/restore'
import type { PreparedRestore, RestoreData } from '../features/backup/restore'
import { useLastBackupStore } from '../features/backup/lastBackupStore'
import { useLastRestoreStore } from '../features/backup/lastRestoreStore'

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

/** Reads and checks a backup file without changing anything. */
export async function checkBackup(json: string): Promise<PreparedRestore> {
  const { prepareRestore } = await import('../features/backup/prepareRestore')
  return prepareRestore(json)
}

/** Every store re-reads the device, so what's on screen matches what was written. */
function reloadStores() {
  useLoanStore.getState().reloadFromStorage()
  useIncomeStore.getState().reloadFromStorage()
  useBillStore.getState().reloadFromStorage()
  useSavingsStore.getState().reloadFromStorage()
  usePrivateFolderStore.getState().reloadFromStorage()
  useLastBackupStore.getState().reloadFromStorage()
  useLastRestoreStore.getState().refresh()
}

/**
 * Replaces the device's data with a checked backup. A safety copy of the
 * old data is kept first, and nothing changes if any part fails to save.
 */
export function applyRestore(data: RestoreData): boolean {
  if (!writeRestore(localStorage, data, new Date())) {
    // A rollback that couldn't finish keeps the safety copy: say how to recover.
    reloadStores()
    showToast(readSafetyCopy(localStorage)
      ? 'Couldn’t finish restoring. Use Undo last restore in Settings to put your data back.'
      : 'Couldn’t restore. Nothing was changed.')
    return false
  }
  reloadStores()
  // What's on the device now matches a file the user has.
  useLastBackupStore.getState().markBackedUp()
  showToast(describeRestoredCounts(data), { label: 'UNDO', onClick: () => { undoLastRestore() } })
  return true
}

/** Puts back what the device held before the last restore. */
export function undoLastRestore(): boolean {
  const hadCopy = readSafetyCopy(localStorage) !== null
  if (!undoRestore(localStorage)) {
    if (hadCopy) {
      // Partly put back: show what's there now, and keep the copy for another try.
      reloadStores()
      showToast('Couldn’t put everything back (storage may be full). Your safety copy is kept, so try again.')
    } else {
      showToast('Nothing to undo')
    }
    return false
  }
  reloadStores()
  showToast('Restore undone')
  return true
}


function describeCount(n: number, singular: string): string {
  return `${n} ${n === 1 ? singular : `${singular}s`}`
}

function describeRestoredCounts(data: RestoreData): string {
  const parts: string[] = []
  if (data.loans.length > 0) parts.push(describeCount(data.loans.length, 'loan'))
  if (data.bills.length > 0) parts.push(describeCount(data.bills.length, 'bill'))
  if (data.savingsGoals.length > 0) parts.push(describeCount(data.savingsGoals.length, 'savings goal'))
  const text = parts.length > 0 ? parts.join(', ') : 'No data'
  return `${text} restored`
}
