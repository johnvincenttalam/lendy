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
 * Free of stores so it can be tested against an in-memory storage.
 */
import type { z } from 'zod'
import type { Loan, PaymentRecord } from '../loans/loanTypes'
import type { Bill, BillPaymentRecord } from '../bills/billTypes'
import type { SavingsGoal, SavingsTransaction } from '../savings/savingsTypes'
import { loanSchema, paymentSchema } from '../loans/loanSchema'
import { billSchema, billPaymentSchema } from '../bills/billSchema'
import { savingsGoalSchema, savingsTransactionSchema } from '../savings/savingsSchema'
import { backfillPayments } from '../loans/paymentBackfill'
import { FOLDER_KEYS, cleanFolderName, parseFolderBackup } from '../privateFolder/privateFolderUtils'
import type { FolderBackup } from '../privateFolder/privateFolderUtils'
import { SCHEMA_VERSION, STORAGE_FIELDS, backupVersion, migrateSnapshot } from './schema'
import type { Snapshot } from './schema'

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

/** Valid records with unique ids, in file order; everything else adds to `skipped`. */
function readList<T extends { id: string }>(value: unknown, schema: z.ZodType<T>, tally: { skipped: number }): T[] {
  if (!Array.isArray(value)) return []
  const seen = new Set<string>()
  const out: T[] = []
  for (const item of value) {
    const parsed = schema.safeParse(item)
    if (!parsed.success || seen.has(parsed.data.id)) {
      tally.skipped++
      continue
    }
    seen.add(parsed.data.id)
    out.push(parsed.data)
  }
  return out
}

export function prepareRestore(json: string): PreparedRestore {
  let raw: unknown
  try {
    raw = JSON.parse(json)
  } catch {
    return { ok: false, reason: 'invalid' }
  }
  if (!raw || typeof raw !== 'object' || !Array.isArray((raw as Snapshot).loans)) return { ok: false, reason: 'invalid' }

  // A file from a newer version could hold data this one would misread.
  const version = backupVersion(raw as Snapshot)
  if (version > SCHEMA_VERSION) return { ok: false, reason: 'newer' }
  const file = migrateSnapshot(raw as Snapshot, version)

  const tally = { skipped: 0 }
  const loans = readList(file.loans, loanSchema, tally)
  // Files from before payment history was kept get it rebuilt from the loans.
  const payments = Array.isArray(file.payments)
    ? readList(file.payments, paymentSchema, tally)
    : backfillPayments(loans, [])
  const income = file.monthlyIncome

  const data: RestoreData = {
    loans,
    payments,
    bills: readList(file.bills, billSchema, tally),
    billPayments: readList(file.billPayments, billPaymentSchema, tally),
    savingsGoals: readList(file.savingsGoals, savingsGoalSchema, tally),
    savingsTransactions: readList(file.savingsTransactions, savingsTransactionSchema, tally),
    monthlyIncome: typeof income === 'number' && Number.isFinite(income) && income >= 0 ? income : null,
    privateFolder: parseFolderBackup(file),
  }

  return {
    ok: true,
    data,
    counts: { loans: data.loans.length, bills: data.bills.length, savingsGoals: data.savingsGoals.length },
    skipped: tally.skipped,
  }
}

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
