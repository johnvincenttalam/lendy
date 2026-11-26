/**
 * Start-up: decide where the data lives, move it into the database the
 * first time, and load it once before the first screen. The choice comes
 * from a flag in the browser's simple storage, read without waiting on the
 * database, so it never depends on the database opening.
 */
import { backfillPayments } from '../loans/paymentBackfill'
import { MIGRATIONS, SCHEMA_VERSION } from '../backup/schema'
import type { Migration } from '../backup/schema'
import type { ActiveStorage } from './activeStorage'
import type { DataBackend, KeyValueStorage } from './backend'
import { getKv } from './db'
import type { OllieDb } from './db'
import { createDexieBackend, upgradeDexieData } from './dexieBackend'
import { fingerprintLegacy } from './fingerprint'
import { createLocalStorageBackend } from './localStorageBackend'
import type { MoveReport } from './move'
import { dexieSafetyStore, localSafetyStore } from './safetyCopyStore'
import type { DataSnapshot } from './snapshot'
import { MOVED_AT_KEY, MOVE_STATUS_KEY, STORAGE_FLAG_KEY } from './storageKeys'
import type { StorageStatus } from './storageStatusStore'

export const OPEN_TIMEOUT_MS = 5000
/** A failed automatic move is retried at most once a day. */
export const MOVE_RETRY_MS = 86_400_000

export type BootEnv = {
  storage: KeyValueStorage
  hasIndexedDb: boolean
  openDb: () => Promise<OllieDb>
  now: Date
  openTimeoutMs?: number
  migrations?: Record<number, Migration>
  target?: number
}

export type BootStatus = Pick<StorageStatus, 'kind' | 'movedAt' | 'justMoved' | 'blocked' | 'failedReason' | 'oldCopyChanged'>

export type BootOutcome =
  | { kind: 'ready'; active: ActiveStorage; snapshot: DataSnapshot; status: BootStatus }
  | { kind: 'error' }
  | { kind: 'recovery'; db: OllieDb; movedAt: string | null }

const baseStatus = (kind: BootStatus['kind']): BootStatus => ({
  kind, movedAt: null, justMoved: false, blocked: null, failedReason: null, oldCopyChanged: false,
})

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('The database took too long to open')), ms)
    promise.then(
      (v) => { clearTimeout(timer); resolve(v) },
      (e: unknown) => { clearTimeout(timer); reject(e instanceof Error ? e : new Error(String(e))) },
    )
  })
}

/** Loans saved before payment history was kept get it rebuilt and saved, as the loan store used to at load. */
async function loadWithBackfill(backend: DataBackend): Promise<DataSnapshot> {
  const snapshot = await backend.readAll()
  const payments = backfillPayments(snapshot.loans, snapshot.payments)
  if (payments.length === snapshot.payments.length) return snapshot
  try {
    await backend.write({ payments: { next: payments, prev: snapshot.payments } })
  } catch (err) {
    console.error('Saving rebuilt payment history failed', err)
  }
  return { ...snapshot, payments }
}

function databaseStorage(db: OllieDb, storage: KeyValueStorage): ActiveStorage {
  return { backend: createDexieBackend(db), safety: dexieSafetyStore(db), prefs: storage, db }
}

async function onSimpleStorage(storage: KeyValueStorage, status: BootStatus): Promise<BootOutcome> {
  const backend = createLocalStorageBackend(storage)
  const active: ActiveStorage = { backend, safety: localSafetyStore(storage), prefs: storage, db: null }
  return { kind: 'ready', active, snapshot: await loadWithBackfill(backend), status }
}

function recentlyFailed(storage: KeyValueStorage, now: Date): boolean {
  try {
    const status = JSON.parse(storage.getItem(MOVE_STATUS_KEY) ?? 'null') as { outcome?: string; at?: string } | null
    if (status?.outcome !== 'failed' || typeof status.at !== 'string') return false
    return now.getTime() - new Date(status.at).getTime() < MOVE_RETRY_MS
  } catch {
    return false
  }
}

export async function bootstrap(env: BootEnv): Promise<BootOutcome> {
  const { storage, now } = env
  const timeout = env.openTimeoutMs ?? OPEN_TIMEOUT_MS
  const flag = storage.getItem(STORAGE_FLAG_KEY)

  if (flag === 'indexeddb') {
    // Once on the database, never fall back to the old copy: explain instead.
    let db: OllieDb
    try {
      db = await withTimeout(env.openDb(), timeout)
    } catch {
      return { kind: 'error' }
    }
    try {
      const migration = await getKv<MoveReport>(db, 'migration')
      if (!migration) return { kind: 'recovery', db, movedAt: storage.getItem(MOVED_AT_KEY) }
      await upgradeDexieData(db, env.migrations ?? MIGRATIONS, env.target ?? SCHEMA_VERSION)
      const active = databaseStorage(db, storage)
      const snapshot = await loadWithBackfill(active.backend)
      const status: BootStatus = {
        ...baseStatus('indexeddb'),
        movedAt: storage.getItem(MOVED_AT_KEY) ?? migration.at ?? null,
        oldCopyChanged: typeof migration.fingerprint === 'string' && fingerprintLegacy(storage) !== migration.fingerprint,
      }
      return { kind: 'ready', active, snapshot, status }
    } catch (err) {
      console.error('Loading from the database failed', err)
      return { kind: 'error' }
    }
  }

  if (flag === null && env.hasIndexedDb) {
    // Loaded only while a move may be needed: it brings in the validation library.
    const { planMove, runMove } = await import('./move')
    // Checking is cheap and changes nothing, so it runs every start until the owner decides.
    const plan = planMove(storage)
    if (plan.quarantine.length > 0) return onSimpleStorage(storage, { ...baseStatus('localstorage'), blocked: plan.quarantine })
    if (recentlyFailed(storage, now)) return onSimpleStorage(storage, baseStatus('localstorage'))

    let reason: string
    try {
      const db = await withTimeout(env.openDb(), timeout)
      const result = await runMove(storage, db, { now })
      if (result.ok) {
        storage.setItem(STORAGE_FLAG_KEY, 'indexeddb')
        storage.setItem(MOVED_AT_KEY, now.toISOString())
        storage.removeItem(MOVE_STATUS_KEY)
        const moved = Object.values(result.report.counts).some((c) => c.moved > 0) || plan.snapshot.monthlyIncome > 0
        const active = databaseStorage(db, storage)
        const status: BootStatus = { ...baseStatus('indexeddb'), movedAt: now.toISOString(), justMoved: moved }
        return { kind: 'ready', active, snapshot: await loadWithBackfill(active.backend), status }
      }
      if (result.outcome === 'blocked') {
        return onSimpleStorage(storage, { ...baseStatus('localstorage'), blocked: result.items })
      }
      reason = result.reason
    } catch (err) {
      reason = err instanceof Error ? err.message : String(err)
    }
    try {
      storage.setItem(MOVE_STATUS_KEY, JSON.stringify({ outcome: 'failed', at: now.toISOString(), reason }))
    } catch {
      // Without the note, the move just tries again next time.
    }
    return onSimpleStorage(storage, { ...baseStatus('localstorage'), failedReason: reason })
  }

  return onSimpleStorage(storage, baseStatus('localstorage'))
}
