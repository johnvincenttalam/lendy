/**
 * What the Storage card and the recovery screen can do: move the data back
 * to simple storage and forward again, refill an emptied database, and
 * hand over the old copy or set-aside records.
 */
import { SCHEMA_KEY, SCHEMA_VERSION } from '../backup/schema'
import { prepareRestore } from '../backup/prepareRestore'
import { writeFolderPrefs } from '../backup/restore'
import type { PreparedRestore } from '../backup/restore'
import type { FolderBackup } from '../privateFolder/privateFolderUtils'
import { ReplaceAllError } from './backend'
import type { KeyValueStorage } from './backend'
import { setKv } from './db'
import type { OllieDb } from './db'
import { createDexieBackend } from './dexieBackend'
import { fingerprintLegacy } from './fingerprint'
import { createLocalStorageBackend, readLegacySnapshot } from './localStorageBackend'
import { runMove } from './move'
import type { MoveResult, QuarantineItem } from './move'
import { whenSaved } from './persist'
import { dexieSafetyStore, localSafetyStore } from './safetyCopyStore'
import { MOVED_AT_KEY, MOVE_STATUS_KEY, STORAGE_FLAG_KEY } from './storageKeys'

/**
 * Copies everything in the database into simple storage and switches to it.
 * All or nothing: if it doesn't fit, simple storage is put back as it was
 * and the data stays in the database. The caller reloads on 'ok'.
 */
export async function moveBack(env: { db: OllieDb; storage: KeyValueStorage }): Promise<'ok' | 'too-big'> {
  await whenSaved()
  const snapshot = await createDexieBackend(env.db).readAll()
  try {
    await createLocalStorageBackend(env.storage).replaceAll(snapshot)
  } catch (err) {
    if (err instanceof ReplaceAllError) return 'too-big'
    throw err
  }
  // A restore that can still be undone stays undoable.
  try {
    const copy = await dexieSafetyStore(env.db).read()
    if (copy) await localSafetyStore(env.storage).write(copy)
  } catch {
    // The data is safe; only the undo offer is lost.
  }
  env.storage.setItem(SCHEMA_KEY, String(SCHEMA_VERSION))
  env.storage.setItem(STORAGE_FLAG_KEY, 'localstorage')
  return 'ok'
}

/** Runs the move on request (Settings). The caller reloads when it worked. */
export async function moveToDatabase(env: {
  storage: KeyValueStorage
  openDb: () => Promise<OllieDb>
  now: Date
  allowQuarantine: boolean
}): Promise<MoveResult> {
  await whenSaved()
  let db: OllieDb
  try {
    db = await env.openDb()
  } catch (err) {
    return { ok: false, outcome: 'failed', reason: err instanceof Error ? err.message : String(err) }
  }
  const result = await runMove(env.storage, db, { now: env.now, allowQuarantine: env.allowQuarantine })
  if (result.ok) {
    env.storage.setItem(STORAGE_FLAG_KEY, 'indexeddb')
    env.storage.setItem(MOVED_AT_KEY, env.now.toISOString())
    env.storage.removeItem(MOVE_STATUS_KEY)
  }
  return result
}

/** Recovery: fills an emptied database from a backup file and marks it ready. */
export async function restoreIntoEmptyDatabase(db: OllieDb, storage: KeyValueStorage, json: string, now: Date): Promise<PreparedRestore> {
  const prepared = prepareRestore(json)
  if (!prepared.ok) return prepared
  const { data } = prepared
  await createDexieBackend(db).replaceAll({
    loans: data.loans,
    payments: data.payments,
    monthlyIncome: data.monthlyIncome ?? 0,
    bills: data.bills,
    billPayments: data.billPayments,
    savingsGoals: data.savingsGoals,
    savingsTransactions: data.savingsTransactions,
  })
  writeFolderPrefs(storage, data)
  await setKv(db, 'schemaVersion', SCHEMA_VERSION)
  await setKv(db, 'migration', { at: now.toISOString(), source: 'backup', fingerprint: fingerprintLegacy(storage) })
  return prepared
}

/** Recovery: fills an emptied database from the old copy kept at the move. Set-aside records stay in that copy. */
export function refillFromOlderCopy(db: OllieDb, storage: KeyValueStorage, now: Date): Promise<MoveResult> {
  return runMove(storage, db, { now, allowQuarantine: true })
}

/** The old copy as a backup file, in the same shape as a normal backup. */
export function legacyBackupJson(storage: KeyValueStorage, privateFolder: FolderBackup | undefined, now: Date): string {
  const snapshot = readLegacySnapshot(storage)
  const version = Number(storage.getItem(SCHEMA_KEY))
  return JSON.stringify({
    schemaVersion: Number.isInteger(version) && version >= 0 ? version : 0,
    ...snapshot,
    privateFolder,
    exportedAt: now.toISOString(),
  }, null, 2)
}

/** Set-aside records, exactly as they were, for copying somewhere safe. */
export function quarantineText(items: QuarantineItem[]): string {
  return JSON.stringify(items, null, 2)
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} bytes`
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}
