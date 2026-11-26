/**
 * Restoring a backup file, in two steps so nothing is changed until the
 * whole file has been read and checked:
 *
 * 1. prepareRestore: parse, upgrade older versions, validate every record.
 *    Records that would break the app (and repeated ids) are skipped and
 *    counted, so the confirmation can say so.
 * 2. writeRestore: save a safety copy of what's stored, then replace every
 *    section in one go. If any part fails, everything is put back.
 *
 * A restore replaces every section: one the file doesn't have becomes empty.
 * The monthly income is a setting, so a file without one leaves it alone.
 * undoRestore brings back the safety copy once, within 7 days.
 *
 * Works on either storage (the browser's simple storage or its database):
 * the data goes through the backend, the folder PIN and last-backup date
 * stay in simple storage, and the safety copy sits next to the data.
 *
 * Step 1 lives in prepareRestore.ts: it pulls in the validation library,
 * so it's loaded only when a file is picked. Free of stores so both can be
 * tested against in-memory storage.
 */
import type { Loan, PaymentRecord } from '../loans/loanTypes'
import type { Bill, BillPaymentRecord } from '../bills/billTypes'
import type { SavingsGoal, SavingsTransaction } from '../savings/savingsTypes'
import { FOLDER_KEYS, cleanFolderName } from '../privateFolder/privateFolderUtils'
import type { FolderBackup } from '../privateFolder/privateFolderUtils'
import { SCHEMA_VERSION } from './schema'
import { LAST_BACKUP_KEY } from './backupStatus'
import { SAFETY_COPY_KEY } from '../storage/safetyCopyStore'
import type { SafetyCopyStore } from '../storage/safetyCopyStore'
import { ReplaceAllError } from '../storage/backend'
import type { KeyValueStorage } from '../storage/backend'
import type { ActiveStorage } from '../storage/activeStorage'
import { emptySnapshot } from '../storage/snapshot'
import type { DataSnapshot } from '../storage/snapshot'

export { SAFETY_COPY_KEY }

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

/** Preferences a restore can change. The last-backup date rides along so an undo also brings back the backup reminder. */
const RESTORE_PREF_KEYS: string[] = [...Object.values(FOLDER_KEYS), LAST_BACKUP_KEY]

export type SafetyCopy = {
  savedAt: string
  schemaVersion: number
  /** The data before the restore, in pesos. */
  snapshot: DataSnapshot
  prefs: Record<string, string | null>
}

/** How long a restore can be undone. */
export const SAFETY_COPY_DAYS = 7

/** What each folder key should hold after the restore; null removes it, undefined leaves it alone. */
function plannedPrefs(data: RestoreData): Record<string, string | null | undefined> {
  const folder = data.privateFolder
  return {
    // Restored private loans come back locked behind the file's folder PIN.
    [FOLDER_KEYS.name]: folder ? cleanFolderName(folder.name) : undefined,
    [FOLDER_KEYS.pinHash]: folder ? folder.pinHash : undefined,
    [FOLDER_KEYS.recoveryHash]: folder ? (folder.pinHash ? folder.recoveryHash : null) : undefined,
  }
}

/** Writes the file's private-folder settings (if it has any) into preferences. */
export function writeFolderPrefs(prefs: KeyValueStorage, data: RestoreData): void {
  for (const [key, value] of Object.entries(plannedPrefs(data))) {
    if (value === undefined) continue
    if (value === null) prefs.removeItem(key)
    else prefs.setItem(key, value)
  }
}

/**
 * Best effort: used to undo a half-done write, so one failure mustn't stop
 * the rest. Returns false if any key couldn't be put back.
 */
function putBack(storage: KeyValueStorage, values: Record<string, string | null>): boolean {
  let ok = true
  for (const [key, value] of Object.entries(values)) {
    try {
      if (value === null) storage.removeItem(key)
      else storage.setItem(key, value)
    } catch {
      ok = false
    }
  }
  return ok
}

async function removeQuietly(safety: SafetyCopyStore): Promise<void> {
  try { await safety.remove() } catch { /* nothing to free */ }
}

/** Replaces the stored data with `data`. False means it failed (see the safety copy). */
export async function writeRestore(active: ActiveStorage, data: RestoreData, now: Date): Promise<boolean> {
  const { backend, safety, prefs } = active
  let before: DataSnapshot
  try {
    before = await backend.readAll()
  } catch {
    return false
  }
  const beforePrefs: Record<string, string | null> = {}
  for (const key of RESTORE_PREF_KEYS) beforePrefs[key] = prefs.getItem(key)

  const copy: SafetyCopy = { savedAt: now.toISOString(), schemaVersion: SCHEMA_VERSION, snapshot: before, prefs: beforePrefs }
  try {
    await safety.write(copy)
  } catch {
    // Without a way back, don't start.
    return false
  }

  const next: DataSnapshot = {
    loans: data.loans,
    payments: data.payments,
    monthlyIncome: data.monthlyIncome ?? before.monthlyIncome,
    bills: data.bills,
    billPayments: data.billPayments,
    savingsGoals: data.savingsGoals,
    savingsTransactions: data.savingsTransactions,
  }
  try {
    await backend.replaceAll(next)
  } catch (err) {
    // Only drop the copy once the old data is known to be fully back; otherwise it's the way to recover.
    if (err instanceof ReplaceAllError && err.rolledBack) await removeQuietly(safety)
    return false
  }

  try {
    writeFolderPrefs(prefs, data)
  } catch {
    const prefsBack = putBack(prefs, beforePrefs)
    let dataBack = true
    try {
      await backend.replaceAll(before)
    } catch {
      dataBack = false
    }
    if (prefsBack && dataBack) await removeQuietly(safety)
    return false
  }
  return true
}

function looksLikeCopy(value: unknown): value is SafetyCopy {
  if (!value || typeof value !== 'object') return false
  const c = value as Partial<SafetyCopy>
  return typeof c.savedAt === 'string'
    && !!c.snapshot && typeof c.snapshot === 'object'
    && !!c.prefs && typeof c.prefs === 'object'
}

/**
 * The copy kept by the last restore, while it can still be undone: for 7 days,
 * and only by the data version that saved it. An expired or foreign copy is
 * deleted, so it doesn't sit in storage for good.
 */
export async function readSafetyCopy(safety: SafetyCopyStore, now: Date = new Date()): Promise<SafetyCopy | null> {
  let raw: unknown
  try {
    raw = await safety.read()
  } catch {
    return null
  }
  if (raw === null || raw === undefined) return null
  const copy = looksLikeCopy(raw) ? raw : null
  const savedAt = copy ? new Date(copy.savedAt).getTime() : NaN
  const usable = copy !== null
    && copy.schemaVersion === SCHEMA_VERSION
    && Number.isFinite(savedAt)
    && now.getTime() - savedAt <= SAFETY_COPY_DAYS * 86_400_000
  if (usable) return copy
  await removeQuietly(safety)
  return null
}

/**
 * Puts back what was stored before the last restore. False if there's
 * nothing to undo, or if some of it couldn't be put back (the copy is then kept).
 */
export async function undoRestore(active: ActiveStorage, now: Date = new Date()): Promise<boolean> {
  const copy = await readSafetyCopy(active.safety, now)
  if (!copy) return false
  try {
    await active.backend.replaceAll({ ...emptySnapshot(), ...copy.snapshot })
  } catch {
    return false
  }
  const values: Record<string, string | null> = {}
  for (const key of RESTORE_PREF_KEYS) values[key] = key in copy.prefs ? copy.prefs[key] : null
  if (!putBack(active.prefs, values)) return false
  await removeQuietly(active.safety)
  return true
}
