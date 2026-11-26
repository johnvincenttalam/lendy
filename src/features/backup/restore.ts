/**
 * Restoring a backup file, in two steps so nothing is changed until the
 * whole file has been read and checked:
 *
 * 1. prepareRestore: parse, upgrade older versions, validate every record.
 *    Records that would break the app (and repeated ids) are skipped and
 *    counted, so the confirmation can say so.
 * 2. writeRestore: save a safety copy of what's on the device, then write
 *    every section. If any write fails, everything is put back.
 *
 * A restore replaces every section: one the file doesn't have becomes empty.
 * The monthly income is a setting, so a file without one leaves it alone.
 * undoRestore brings back the safety copy once.
 *
 * Step 1 lives in prepareRestore.ts: it pulls in the validation library,
 * so it's loaded only when a file is picked. Free of stores so both can be
 * tested against an in-memory storage.
 */
import type { Loan, PaymentRecord } from '../loans/loanTypes'
import type { Bill, BillPaymentRecord } from '../bills/billTypes'
import type { SavingsGoal, SavingsTransaction } from '../savings/savingsTypes'
import { FOLDER_KEYS, cleanFolderName } from '../privateFolder/privateFolderUtils'
import type { FolderBackup } from '../privateFolder/privateFolderUtils'
import { STORAGE_FIELDS } from './schema'

export const SAFETY_COPY_KEY = 'loan-tracker-pre-restore'

type KeyValueStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

export type RestoreData = {
  loans: Loan[]
  payments: PaymentRecord[]
  bills: Bill[]
  billPayments: BillPaymentRecord[]
  savingsGoals: SavingsGoal[]
  savingsTransactions: SavingsTransaction[]
  /** null: the file has none, keep the device's. */
  monthlyIncome: number | null
  /** null: the file has none, keep the device's folder settings. */
  privateFolder: FolderBackup | null
}

export type RestoreCounts = { loans: number; bills: number; savingsGoals: number }

export type PreparedRestore =
  | { ok: true; data: RestoreData; counts: RestoreCounts; skipped: number }
  | { ok: false; reason: 'invalid' | 'newer' }

/** Every device key a restore can change. */
const RESTORE_KEYS: string[] = [...Object.values(STORAGE_FIELDS), ...Object.values(FOLDER_KEYS)]

export type SafetyCopy = { savedAt: string; values: Record<string, string | null> }

/** What each key should hold after the restore; null removes it, undefined leaves it alone. */
function plannedValues(data: RestoreData): Record<string, string | null | undefined> {
  const folder = data.privateFolder
  return {
    [STORAGE_FIELDS.loans]: JSON.stringify(data.loans),
    [STORAGE_FIELDS.payments]: JSON.stringify(data.payments),
    [STORAGE_FIELDS.bills]: JSON.stringify(data.bills),
    [STORAGE_FIELDS.billPayments]: JSON.stringify(data.billPayments),
    [STORAGE_FIELDS.savingsGoals]: JSON.stringify(data.savingsGoals),
    [STORAGE_FIELDS.savingsTransactions]: JSON.stringify(data.savingsTransactions),
    [STORAGE_FIELDS.monthlyIncome]: data.monthlyIncome === null ? undefined : String(data.monthlyIncome),
    // Restored private loans come back locked behind the file's folder PIN.
    [FOLDER_KEYS.name]: folder ? cleanFolderName(folder.name) : undefined,
    [FOLDER_KEYS.pinHash]: folder ? folder.pinHash : undefined,
    [FOLDER_KEYS.recoveryHash]: folder ? (folder.pinHash ? folder.recoveryHash : null) : undefined,
  }
}

function putValues(storage: KeyValueStorage, values: Record<string, string | null | undefined>) {
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) continue
    if (value === null) storage.removeItem(key)
    else storage.setItem(key, value)
  }
}

/** Best effort: used to undo a half-done write, so one failure mustn't stop the rest. */
function putBack(storage: KeyValueStorage, values: Record<string, string | null>) {
  for (const [key, value] of Object.entries(values)) {
    try {
      if (value === null) storage.removeItem(key)
      else storage.setItem(key, value)
    } catch {
      // Keep going with the other keys.
    }
  }
}

/** Replaces the device's data with `data`. False means nothing was changed. */
export function writeRestore(storage: KeyValueStorage, data: RestoreData, now: Date): boolean {
  const before: Record<string, string | null> = {}
  for (const key of RESTORE_KEYS) before[key] = storage.getItem(key)

  const copy: SafetyCopy = { savedAt: now.toISOString(), values: before }
  try {
    storage.setItem(SAFETY_COPY_KEY, JSON.stringify(copy))
  } catch {
    // Without a way back, don't start.
    return false
  }

  try {
    putValues(storage, plannedValues(data))
    return true
  } catch {
    putBack(storage, before)
    storage.removeItem(SAFETY_COPY_KEY)
    return false
  }
}

export function readSafetyCopy(storage: KeyValueStorage): SafetyCopy | null {
  try {
    const raw = storage.getItem(SAFETY_COPY_KEY)
    if (!raw) return null
    const copy = JSON.parse(raw) as SafetyCopy
    return typeof copy?.savedAt === 'string' && copy.values && typeof copy.values === 'object' ? copy : null
  } catch {
    return null
  }
}

/** Puts back what the device held before the last restore. False if there's nothing to undo. */
export function undoRestore(storage: KeyValueStorage): boolean {
  const copy = readSafetyCopy(storage)
  if (!copy) return false
  const values: Record<string, string | null> = {}
  for (const key of RESTORE_KEYS) values[key] = key in copy.values ? copy.values[key] : null
  putBack(storage, values)
  storage.removeItem(SAFETY_COPY_KEY)
  return true
}
