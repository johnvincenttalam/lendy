import 'fake-indexeddb/auto'
import { describe, it, expect, vi } from 'vitest'
import { bootstrap } from './bootstrap'
import type { BootEnv } from './bootstrap'
import { createOllieDb } from './db'
import { createDexieBackend } from './dexieBackend'
import { readLegacySnapshot } from './localStorageBackend'
import { memoryStorage } from './testStorage'
import type { MemoryStorage } from './testStorage'
import { MOVED_AT_KEY, MOVE_STATUS_KEY, STORAGE_FLAG_KEY } from './storageKeys'
import { STORAGE_FIELDS } from '../backup/schema'
import type { Snapshot } from '../backup/schema'
import type { Loan } from '../loans/loanTypes'

// Synthetic records only — never real data.
const loan = (over: Record<string, unknown> = {}) => ({
  id: 'L1', name: 'Phone', color: '#3B82F6', totalAmount: 12000, monthlyPayment: 1000,
  interestRate: 0, durationMonths: 12, startDate: '2026-01-15', monthsPaid: 0, totalPaid: 0,
  totalInterestPaid: 0, createdAt: '2026-01-01T00:00:00.000Z', ...over,
})

const T0 = new Date('2026-11-27T08:00:00Z')
const hours = (n: number) => new Date(T0.getTime() + n * 3_600_000)

function withLoans(loans: unknown[]): MemoryStorage {
  return memoryStorage({ [STORAGE_FIELDS.loans]: JSON.stringify(loans), [STORAGE_FIELDS.monthlyIncome]: '30000' })
}

function env(storage: MemoryStorage, over: Partial<BootEnv> = {}) {
  const name = `t-${crypto.randomUUID()}`
  const openDb = vi.fn(async () => {
    const db = createOllieDb(name)
    await db.open()
    return db
  })
  return { storage, hasIndexedDb: true, openDb, now: T0, ...over } satisfies BootEnv
}

describe('start-up', () => {
  it('a first visit moves to the database', async () => {
    const e = env(memoryStorage())
    const out = await bootstrap(e)
    expect(out.kind).toBe('ready')
    if (out.kind !== 'ready') return
    expect(out.active.backend.kind).toBe('indexeddb')
    expect(e.storage.getItem(STORAGE_FLAG_KEY)).toBe('indexeddb')
    expect(out.status.justMoved).toBe(false)
  })

  it('existing data moves, and the owner is told once', async () => {
    const s = withLoans([loan()])
    const out = await bootstrap(env(s))
    if (out.kind !== 'ready') throw new Error(out.kind)
    expect(out.status.justMoved).toBe(true)
    expect(out.status.movedAt).toBe(T0.toISOString())
    expect(s.getItem(MOVED_AT_KEY)).toBe(T0.toISOString())
    expect(out.snapshot).toEqual(readLegacySnapshot(s))
  })

  it('a record that would be set aside keeps simple storage and lists it', async () => {
    const e = env(withLoans([loan(), loan({ id: 'L2', totalAmount: 'abc' })]))
    const out = await bootstrap(e)
    if (out.kind !== 'ready') throw new Error(out.kind)
    expect(out.active.backend.kind).toBe('localstorage')
    expect(out.status.blocked).toHaveLength(1)
    expect(e.storage.getItem(STORAGE_FLAG_KEY)).toBeNull()
    expect(e.openDb).not.toHaveBeenCalled()
  })

  it("a database that won't open on the first visit keeps simple storage", async () => {
    const s = withLoans([loan()])
    const failing = vi.fn(async () => { throw new Error('blocked by the browser') })
    const out = await bootstrap({ storage: s, hasIndexedDb: true, openDb: failing, now: T0 })
    if (out.kind !== 'ready') throw new Error(out.kind)
    expect(out.active.backend.kind).toBe('localstorage')
    expect(out.status.failedReason).toMatch(/blocked/)
    expect(JSON.parse(s.getItem(MOVE_STATUS_KEY)!)).toMatchObject({ outcome: 'failed', at: T0.toISOString() })
    expect(out.snapshot.loans).toHaveLength(1)

    await bootstrap({ storage: s, hasIndexedDb: true, openDb: failing, now: hours(1) })
    expect(failing).toHaveBeenCalledTimes(1)
    await bootstrap({ storage: s, hasIndexedDb: true, openDb: failing, now: hours(25) })
    expect(failing).toHaveBeenCalledTimes(2)
  })

  it('on the database, loads from it', async () => {
    const s = withLoans([loan()])
    const e = env(s)
    await bootstrap(e)
    const again = await bootstrap({ ...e, now: hours(2) })
    if (again.kind !== 'ready') throw new Error(again.kind)
    expect(again.active.backend.kind).toBe('indexeddb')
    expect(again.status.oldCopyChanged).toBe(false)
    expect(again.status.justMoved).toBe(false)

    // An older window writes to the old copy after the move.
    s.setItem(STORAGE_FIELDS.loans, JSON.stringify([loan(), loan({ id: 'L9', name: 'From an old tab' })]))
    const later = await bootstrap({ ...e, now: hours(3) })
    if (later.kind !== 'ready') throw new Error(later.kind)
    expect(later.status.oldCopyChanged).toBe(true)
    expect(later.snapshot.loans.map((l) => l.id)).toEqual(['L1'])
  })

  it("on the database, a database that won't open shows the error", async () => {
    const s = memoryStorage({ [STORAGE_FLAG_KEY]: 'indexeddb' })
    const out = await bootstrap({ storage: s, hasIndexedDb: true, openDb: () => new Promise(() => {}), now: T0, openTimeoutMs: 20 })
    expect(out).toEqual({ kind: 'error' })
    expect(s.getItem(STORAGE_FLAG_KEY)).toBe('indexeddb')
  })

  it('an emptied database shows recovery, not an empty app', async () => {
    const s = withLoans([loan()])
    s.setItem(STORAGE_FLAG_KEY, 'indexeddb')
    s.setItem(MOVED_AT_KEY, '2026-11-20T08:00:00.000Z')
    const out = await bootstrap(env(s))
    expect(out.kind).toBe('recovery')
    if (out.kind !== 'recovery') return
    expect(out.movedAt).toBe('2026-11-20T08:00:00.000Z')
  })

  it('database data is upgraded when the data version rises', async () => {
    const e = env(withLoans([loan()]))
    await bootstrap(e)
    const migrations = { 2: (s: Snapshot) => ({ ...s, loans: (s.loans as Loan[]).map((l) => ({ ...l, tag: 'migrated' })) }) }
    const out = await bootstrap({ ...e, migrations, target: 2 })
    if (out.kind !== 'ready') throw new Error(out.kind)
    expect(out.snapshot.loans[0].tag).toBe('migrated')
  })

  it('having gone back, stays on simple storage', async () => {
    const s = withLoans([loan()])
    s.setItem(STORAGE_FLAG_KEY, 'localstorage')
    const e = env(s)
    const out = await bootstrap(e)
    if (out.kind !== 'ready') throw new Error(out.kind)
    expect(out.active.backend.kind).toBe('localstorage')
    expect(e.openDb).not.toHaveBeenCalled()
  })

  it('loans saved before payment history get it rebuilt on either storage', async () => {
    const paid = loan({ monthsPaid: 2, totalPaid: 2000 })

    const local = withLoans([paid])
    local.setItem(STORAGE_FLAG_KEY, 'localstorage')
    const a = await bootstrap(env(local))
    if (a.kind !== 'ready') throw new Error(a.kind)
    expect(a.snapshot.payments).toHaveLength(2)
    expect(JSON.parse(local.getItem(STORAGE_FIELDS.payments)!)).toHaveLength(2)

    // On the database: payments lost after the move are rebuilt and saved there.
    const e = env(withLoans([paid]))
    const first = await bootstrap(e)
    if (first.kind !== 'ready' || !first.active.db) throw new Error(first.kind)
    await first.active.db.payments.clear()
    const b = await bootstrap({ ...e, now: hours(1) })
    if (b.kind !== 'ready' || !b.active.db) throw new Error(b.kind)
    expect(b.snapshot.payments).toHaveLength(2)
    expect((await createDexieBackend(b.active.db).readAll()).payments).toHaveLength(2)
  })
})
