import 'fake-indexeddb/auto'
import { describe, it, expect } from 'vitest'
import { formatBytes, legacyBackupJson, moveBack, moveToDatabase, refillFromOlderCopy, restoreIntoEmptyDatabase } from './storageActions'
import { bootstrap } from './bootstrap'
import { createOllieDb } from './db'
import { createDexieBackend } from './dexieBackend'
import { readLegacySnapshot } from './localStorageBackend'
import { runMove } from './move'
import { persist } from './persist'
import { setActiveStorage } from './activeStorage'
import { dexieSafetyStore, localSafetyStore } from './safetyCopyStore'
import { memoryStorage } from './testStorage'
import type { MemoryStorage } from './testStorage'
import { STORAGE_FLAG_KEY, MOVED_AT_KEY } from './storageKeys'
import { STORAGE_FIELDS } from '../backup/schema'
import { prepareRestore } from '../backup/prepareRestore'
import type { Loan } from '../loans/loanTypes'

// Synthetic records only — never real data.
const loan = (over: Partial<Loan> = {}): Loan => ({
  id: 'L1', name: 'Phone', color: '#3B82F6', totalAmount: 12000, monthlyPayment: 1000,
  interestRate: 0, durationMonths: 12, startDate: '2026-01-15', monthsPaid: 0, totalPaid: 0,
  totalInterestPaid: 0, createdAt: '2026-01-01T00:00:00.000Z', ...over,
})

const now = new Date('2026-11-27T08:00:00Z')
const dbName = () => `t-${crypto.randomUUID()}`

function legacy(loans: Loan[] = [loan(), loan({ id: 'L2', name: 'Laptop' })]): MemoryStorage {
  return memoryStorage({ [STORAGE_FIELDS.loans]: JSON.stringify(loans), [STORAGE_FIELDS.monthlyIncome]: '30000' })
}

async function moved() {
  const storage = legacy()
  const db = createOllieDb(dbName())
  const r = await runMove(storage, db, { now })
  if (!r.ok) throw new Error('move failed')
  storage.setItem(STORAGE_FLAG_KEY, 'indexeddb')
  return { storage, db }
}

const opener = (name: string) => async () => {
  const db = createOllieDb(name)
  await db.open()
  return db
}

describe('moving between storages', () => {
  it('moving back copies everything, and moving forward again gives the same data', async () => {
    const { storage, db } = await moved()
    const backend = createDexieBackend(db)
    const before = await backend.readAll()
    await backend.write({ loans: { prev: before.loans, next: [...before.loans, loan({ id: 'L3', name: 'Added later' })] } })
    const current = await backend.readAll()

    expect(await moveBack({ db, storage })).toBe('ok')
    expect(readLegacySnapshot(storage)).toEqual(current)
    expect(storage.getItem(STORAGE_FLAG_KEY)).toBe('localstorage')

    const r = await moveToDatabase({ storage, openDb: async () => db, now, allowQuarantine: false })
    expect(r.ok).toBe(true)
    expect(await backend.readAll()).toEqual(current)
    expect(storage.getItem(STORAGE_FLAG_KEY)).toBe('indexeddb')
    expect(storage.getItem(MOVED_AT_KEY)).toBe(now.toISOString())
  })

  it('moving back waits for a change still being saved', async () => {
    const { storage, db } = await moved()
    const backend = createDexieBackend(db)
    setActiveStorage({ backend, safety: dexieSafetyStore(db), prefs: storage, db })
    const before = await backend.readAll()
    void persist({ loans: { prev: before.loans, next: [...before.loans, loan({ id: 'L9', name: 'Just typed' })] } })
    expect(await moveBack({ db, storage })).toBe('ok')
    expect(readLegacySnapshot(storage).loans.map((l) => l.id)).toContain('L9')
  })

  it("moving back that doesn't fit stays on the database", async () => {
    const { storage, db } = await moved()
    const before = Object.values(STORAGE_FIELDS).map((k) => storage.getItem(k))
    storage.failOnSet = (k) => (Object.values(STORAGE_FIELDS) as string[]).includes(k)
    expect(await moveBack({ db, storage })).toBe('too-big')
    storage.failOnSet = null
    expect(storage.getItem(STORAGE_FLAG_KEY)).toBe('indexeddb')
    expect(Object.values(STORAGE_FIELDS).map((k) => storage.getItem(k))).toEqual(before)
  })

  it('moving back carries the undo-restore copy', async () => {
    const { storage, db } = await moved()
    const copy = { savedAt: now.toISOString(), schemaVersion: 1, snapshot: await createDexieBackend(db).readAll(), prefs: {} }
    await dexieSafetyStore(db).write(copy)
    await moveBack({ db, storage })
    expect(await localSafetyStore(storage).read()).toEqual(copy)
  })
})

describe('recovery', () => {
  it('restoring a file into an emptied database makes it usable again', async () => {
    const storage = memoryStorage({ [STORAGE_FLAG_KEY]: 'indexeddb' })
    const name = dbName()
    const db = await opener(name)()
    const json = JSON.stringify({ schemaVersion: 1, loans: [loan({ id: 'F1', name: 'From file' })], monthlyIncome: 25000 })
    const r = await restoreIntoEmptyDatabase(db, storage, json, now)
    expect(r.ok).toBe(true)
    const out = await bootstrap({ storage, hasIndexedDb: true, openDb: opener(name), now })
    if (out.kind !== 'ready') throw new Error(out.kind)
    expect(out.active.backend.kind).toBe('indexeddb')
    expect(out.snapshot.loans.map((l) => l.id)).toEqual(['F1'])
    expect(out.snapshot.monthlyIncome).toBe(25000)
  })

  it('using the older copy fills an emptied database', async () => {
    const storage = legacy()
    storage.setItem(STORAGE_FLAG_KEY, 'indexeddb')
    const name = dbName()
    const r = await refillFromOlderCopy(await opener(name)(), storage, now)
    expect(r.ok).toBe(true)
    const out = await bootstrap({ storage, hasIndexedDb: true, openDb: opener(name), now })
    if (out.kind !== 'ready') throw new Error(out.kind)
    expect(out.snapshot.loans.map((l) => l.id)).toEqual(['L1', 'L2'])
  })

  it('the old copy saves as a backup file that restores', () => {
    const storage = legacy()
    const r = prepareRestore(legacyBackupJson(storage, undefined, now))
    if (!r.ok) throw new Error(r.reason)
    expect(r.data.loans.map((l) => l.id)).toEqual(['L1', 'L2'])
    expect(r.data.monthlyIncome).toBe(30000)
  })
})

describe('formatBytes', () => {
  it('reads like a person would say it', () => {
    expect(formatBytes(512)).toBe('512 bytes')
    expect(formatBytes(122880)).toBe('120 KB')
    expect(formatBytes(5_400_000)).toBe('5.1 MB')
  })
})
