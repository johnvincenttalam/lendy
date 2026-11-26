/**
 * What the Storage card and the recovery screen can do: move the data back
 * to simple storage and forward again, refill an emptied database, and
 * hand over the old copy or set-aside records.
 */
import { SCHEMA_KEY, SCHEMA_VERSION } from '../backup/schema'
import { prepareRestore } from '../backup/prepareRestore'
import { buildBackup } from '../backup/envelope'
import { CURRENT_VERSION } from '../whatsNew/changelog'
import { writeFolderPrefs } from '../backup/restore'
import type { PreparedRestore } from '../backup/restore'
import type { FolderBackup } from '../privateFolder/privateFolderUtils'
import { ReplaceAllError } from './backend'
import type { KeyValueStorage } from './backend'
import { getKv, setKv } from './db'
import type { OllieDb, QuarantineRow } from './db'
import { createDexieBackend } from './dexieBackend'
import { fingerprintLegacy } from './fingerprint'
import { createLocalStorageBackend, readLegacySnapshot } from './localStorageBackend'
import { runMove } from './move'
import type { MoveResult, QuarantineItem } from './move'
import { whenSaved } from './persist'
import { dexieSafetyStore, localSafetyStore } from './safetyCopyStore'
import { MOVED_AT_KEY, MOVE_STATUS_KEY, STORAGE_FLAG_KEY } from './storageKeys'

/**
 * True when the old copy in simple storage holds something the database
 * doesn't: records set aside by "Move anyway", or changes an older window
 * made after the move. Moving back would overwrite them.
 */
export async function oldCopyDiffers(db: OllieDb, storage: KeyValueStorage): Promise<boolean> {
  if ((await db.quarantine.count()) > 0) return true
  const migration = await getKv<{ fingerprint?: unknown }>(db, 'migration')
  return typeof migration?.fingerprint === 'string' && migration.fingerprint !== fingerprintLegacy(storage)
}

/**
 * Copies everything in the database into simple storage and switches to it.
 * All or nothing: if it doesn't fit, simple storage is put back as it was
 * and the data stays in the database. If the old copy holds something the
 * database doesn't, it waits ('old-copy-differs') until the owner has saved
 * that copy as a file (`oldCopySaved`). The caller reloads on 'ok'.
 */
export async function moveBack(env: { db: OllieDb; storage: KeyValueStorage; oldCopySaved?: boolean }): Promise<'ok' | 'too-big' | 'old-copy-differs'> {
  await whenSaved()
  if (!env.oldCopySaved && (await oldCopyDiffers(env.db, env.storage))) return 'old-copy-differs'
  const snapshot = await createDexieBackend(env.db).readAll()
  try {
    await createLocalStorageBackend(env.storage).replaceAll(snapshot)
  } catch (err) {
    if (err instanceof ReplaceAllError) return 'too-big'
    throw err
  }
  // The undo-restore offer follows the data exactly, so a used-up one can't come back.
  try {
    const copy = await dexieSafetyStore(env.db).read()
    if (copy) await localSafetyStore(env.storage).write(copy)
    else await localSafetyStore(env.storage).remove()
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
  const result = await runMove(env.storage, db, { now: env.now, allowQuarantine: env.allowQuarantine, replaceExisting: true })
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
  return runMove(storage, db, { now, allowQuarantine: true, replaceExisting: true })
}

/**
 * The old copy as a backup file, in the same shape as a normal backup. Records
 * the move set aside ride along under `setAside`, exactly as they were.
 */
export function legacyBackupJson(storage: KeyValueStorage, privateFolder: FolderBackup | undefined, now: Date, setAside?: (QuarantineItem | QuarantineRow)[]): Promise<string> {
  const version = Number(storage.getItem(SCHEMA_KEY))
  return buildBackup({
    snapshot: readLegacySnapshot(storage),
    // The old copy's own data version, so a restore upgrades it if needed.
    schemaVersion: Number.isInteger(version) && version >= 0 ? version : 0,
    appVersion: CURRENT_VERSION,
    exportedAt: now.toISOString(),
    privateFolder,
    setAside,
  })
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
