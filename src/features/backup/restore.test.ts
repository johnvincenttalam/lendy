import 'fake-indexeddb/auto'
import { describe, it, expect } from 'vitest'
import { writeRestore, undoRestore, readSafetyCopy, SAFETY_COPY_KEY } from './restore'
import { prepareRestore } from './prepareRestore'
import type { RestoreData } from './restore'
import { SCHEMA_VERSION, STORAGE_FIELDS } from './schema'
import { memoryStorage } from '../storage/testStorage'
import type { MemoryStorage } from '../storage/testStorage'
import { createLocalStorageBackend } from '../storage/localStorageBackend'
import { createDexieBackend } from '../storage/dexieBackend'
import { createOllieDb } from '../storage/db'
import { dexieSafetyStore, localSafetyStore } from '../storage/safetyCopyStore'
import type { SafetyCopyStore } from '../storage/safetyCopyStore'
import type { ActiveStorage } from '../storage/activeStorage'
import { emptySnapshot } from '../storage/snapshot'
import type { DataSnapshot, RecordField } from '../storage/snapshot'
import type { Loan } from '../loans/loanTypes'
import type { Bill } from '../bills/billTypes'
import { LAST_BACKUP_KEY } from './backupStatus'

// Synthetic records only — never real data.
const loan = (over: Record<string, unknown> = {}) => ({
  id: 'L1', name: 'Phone', color: '#3B82F6', totalAmount: 12000, monthlyPayment: 1000,
  interestRate: 0, durationMonths: 12, startDate: '2026-01-15', monthsPaid: 0, totalPaid: 0,
  totalInterestPaid: 0, createdAt: '2026-01-01T00:00:00.000Z', ...over,
})
const bill = (over: Record<string, unknown> = {}) => ({
  id: 'B1', name: 'Internet', color: '#10B981', category: 'Internet/Phone', amount: 1500,
  nextDueDate: '2026-12-05', createdAt: '2026-01-01T00:00:00.000Z', ...over,
})
const goal = (over: Record<string, unknown> = {}) => ({
  id: 'G1', name: 'Emergency fund', color: '#F59E0B', targetAmount: 50000, currentAmount: 1000,
  createdAt: '2026-01-01T00:00:00.000Z', ...over,
})
const file = (over: Record<string, unknown> = {}) => JSON.stringify({
  schemaVersion: 1, loans: [loan()], payments: [], monthlyIncome: 30000,
  bills: [bill()], billPayments: [], savingsGoals: [goal()], savingsTransactions: [], ...over,
})

function prepared(json: string) {
  const r = prepareRestore(json)
  if (!r.ok) throw new Error(`expected ok, got ${r.reason}`)
  return r
}

describe('prepareRestore', () => {
  it('rejects text that is not a backup', () => {
    expect(prepareRestore('not json')).toEqual({ ok: false, reason: 'invalid' })
    expect(prepareRestore('{"bills": []}')).toEqual({ ok: false, reason: 'invalid' })
  })

  it('rejects files from a newer version', () => {
    expect(prepareRestore(file({ schemaVersion: 99 }))).toEqual({ ok: false, reason: 'newer' })
  })

  it('reads every section of a current backup', () => {
    const r = prepared(file())
    expect(r.counts).toEqual({ loans: 1, bills: 1, savingsGoals: 1 })
    expect(r.data.monthlyIncome).toBe(30000)
    expect(r.skipped).toBe(0)
  })

  it('fills in fields that older versions did not save', () => {
    const old = loan({ color: undefined, interestRate: undefined, totalInterestPaid: undefined })
    const [l] = prepared(file({ loans: [old] })).data.loans
    expect(l.color).toBe('#F3622D')
    expect(l.interestRate).toBe(0)
    expect(l.totalInterestPaid).toBe(0)
  })

  it('skips records that would break the app, and counts them', () => {
    const r = prepared(file({ loans: [loan(), loan({ id: 'L2', startDate: 'soon' }), loan({ id: 'L3', totalAmount: '12000' })] }))
    expect(r.data.loans.map((l) => l.id)).toEqual(['L1'])
    expect(r.skipped).toBe(2)
  })

  it('keeps only the first of two records with the same id', () => {
    const r = prepared(file({ loans: [loan({ name: 'First' }), loan({ name: 'Second' })] }))
    expect(r.data.loans.map((l) => l.name)).toEqual(['First'])
    expect(r.skipped).toBe(1)
  })

  it('keeps fields it does not know about', () => {
    const [l] = prepared(file({ loans: [loan({ futureField: 'kept' })] })).data.loans
    expect((l as Record<string, unknown>).futureField).toBe('kept')
  })

  it('treats a missing section as empty, so a restore replaces everything', () => {
    const r = prepared(JSON.stringify({ loans: [loan()] }))
    expect(r.data.bills).toEqual([])
    expect(r.data.savingsGoals).toEqual([])
    expect(r.data.savingsTransactions).toEqual([])
  })

  it('leaves the income alone when the file has none', () => {
    expect(prepared(JSON.stringify({ loans: [] })).data.monthlyIncome).toBeNull()
  })

  it('rebuilds payment history for old files that had none', () => {
    const r = prepared(JSON.stringify({ loans: [loan({ monthsPaid: 2, totalPaid: 2000 })] }))
    expect(r.data.payments.map((p) => p.month)).toEqual([1, 2])
    expect(r.data.payments.every((p) => p.loanId === 'L1')).toBe(true)
  })

  it('brings back the private folder when the file has one', () => {
    const r = prepared(file({ privateFolder: { name: 'Side', pinHash: 'abc', recoveryHash: null } }))
    expect(r.data.privateFolder).toEqual({ name: 'Side', pinHash: 'abc', recoveryHash: null })
  })
})

type Harness = {
  active: ActiveStorage
  prefs: MemoryStorage
  failReplaceOn: (field: RecordField) => void
  failSafetyCopy: () => void
  data: () => Promise<DataSnapshot>
  safetyRaw: () => Promise<unknown>
}

const OLD = (): DataSnapshot => ({
  ...emptySnapshot(),
  loans: [loan({ id: 'OLD', name: 'Old loan' }) as Loan],
  bills: [bill({ id: 'OLDB' }) as Bill],
  monthlyIncome: 20000,
})

function failingSafety(inner: SafetyCopyStore, fail: { on: boolean }): SafetyCopyStore {
  return {
    read: () => inner.read(),
    remove: () => inner.remove(),
    write: async (copy) => {
      if (fail.on) throw new Error('QuotaExceededError')
      return inner.write(copy)
    },
  }
}

async function makeLocal(): Promise<Harness> {
  const s = memoryStorage()
  const backend = createLocalStorageBackend(s)
  await backend.replaceAll(OLD())
  return {
    active: { backend, safety: localSafetyStore(s), prefs: s, db: null },
    prefs: s,
    failReplaceOn: (field) => { s.failOnSet = (key) => key === STORAGE_FIELDS[field] },
    failSafetyCopy: () => { s.failOnSet = (key) => key === SAFETY_COPY_KEY },
    data: () => backend.readAll(),
    safetyRaw: () => localSafetyStore(s).read(),
  }
}

async function makeDexie(): Promise<Harness> {
  const db = createOllieDb(`t-${crypto.randomUUID()}`)
  const backend = createDexieBackend(db)
  await backend.replaceAll(OLD())
  const prefs = memoryStorage()
  const fail = { on: false }
  return {
    active: { backend, safety: failingSafety(dexieSafetyStore(db), fail), prefs, db },
    prefs,
    failReplaceOn: (field) => { db.recordTable(field).hook('creating', () => { throw new Error('QuotaExceededError') }) },
    failSafetyCopy: () => { fail.on = true },
    data: () => backend.readAll(),
    safetyRaw: () => dexieSafetyStore(db).read(),
  }
}

const incoming = (): RestoreData => prepared(file()).data
const ids = (records: { id: string }[]) => records.map((r) => r.id)
const T0 = new Date('2026-11-26T10:00:00Z')
const days = (n: number) => new Date(T0.getTime() + n * 86_400_000)

describe.each([
  ['simple storage', makeLocal],
  ['the database', makeDexie],
])('restoring on %s', (_name, make) => {
  describe('writeRestore', () => {
    it('replaces every section on the device', async () => {
      const h = await make()
      expect(await writeRestore(h.active, incoming(), T0)).toBe(true)
      const d = await h.data()
      expect(ids(d.loans)).toEqual(['L1'])
      expect(ids(d.bills)).toEqual(['B1'])
      expect(d.monthlyIncome).toBe(30000)
    })

    it('keeps a safety copy of what was there before', async () => {
      const h = await make()
      await writeRestore(h.active, incoming(), T0)
      const copy = await readSafetyCopy(h.active.safety, new Date('2026-11-26T10:05:00Z'))
      expect(copy?.savedAt).toBe('2026-11-26T10:00:00.000Z')
      expect(copy!.snapshot.loans[0].id).toBe('OLD')
    })

    it('leaves the income as it was when the file has none', async () => {
      const h = await make()
      await writeRestore(h.active, { ...incoming(), monthlyIncome: null }, T0)
      expect((await h.data()).monthlyIncome).toBe(20000)
    })

    it('changes nothing if one part fails to save', async () => {
      const h = await make()
      h.failReplaceOn('savingsGoals')
      expect(await writeRestore(h.active, incoming(), T0)).toBe(false)
      expect(await h.data()).toEqual(OLD())
    })

    it('changes nothing if the safety copy cannot be kept', async () => {
      const h = await make()
      h.failSafetyCopy()
      expect(await writeRestore(h.active, incoming(), T0)).toBe(false)
      expect(ids((await h.data()).loans)).toEqual(['OLD'])
    })
  })

  describe('undoRestore', () => {
    it('puts back what was there before the restore', async () => {
      const h = await make()
      await writeRestore(h.active, incoming(), T0)
      expect(await undoRestore(h.active, T0)).toBe(true)
      expect(await h.data()).toEqual(OLD())
    })

    it('can only be used once', async () => {
      const h = await make()
      await writeRestore(h.active, incoming(), T0)
      await undoRestore(h.active, T0)
      expect(await readSafetyCopy(h.active.safety, T0)).toBeNull()
      expect(await undoRestore(h.active, T0)).toBe(false)
    })
  })

  describe('safety copy limits', () => {
    it('keeps the safety copy and says so when putting the old data back fails', async () => {
      const h = await make()
      await writeRestore(h.active, incoming(), T0)
      h.failReplaceOn('loans')
      expect(await undoRestore(h.active, T0)).toBe(false)
      expect(await readSafetyCopy(h.active.safety, T0)).not.toBeNull()
    })

    it('records the data version it was saved with', async () => {
      const h = await make()
      await writeRestore(h.active, incoming(), T0)
      expect((await readSafetyCopy(h.active.safety, T0))?.schemaVersion).toBe(SCHEMA_VERSION)
    })

    it('stops offering an undo after 7 days, and frees the space', async () => {
      const h = await make()
      await writeRestore(h.active, incoming(), T0)
      expect(await readSafetyCopy(h.active.safety, days(7))).not.toBeNull()
      expect(await readSafetyCopy(h.active.safety, days(8))).toBeNull()
      expect(await h.safetyRaw()).toBeNull()
      expect(await undoRestore(h.active, days(8))).toBe(false)
      expect(ids((await h.data()).loans)).toEqual(['L1'])
    })

    it('won’t put back data saved by a different version of Ollie', async () => {
      const h = await make()
      await h.active.safety.write({ savedAt: T0.toISOString(), schemaVersion: SCHEMA_VERSION - 1, snapshot: emptySnapshot(), prefs: {} })
      expect(await readSafetyCopy(h.active.safety, T0)).toBeNull()
      expect(await undoRestore(h.active, T0)).toBe(false)
    })
  })

  it('puts back the last-backup date on undo, so the backup reminder comes back', async () => {
    const h = await make()
    h.prefs.setItem(LAST_BACKUP_KEY, '2026-09-01T00:00:00.000Z')
    await writeRestore(h.active, incoming(), T0)
    h.prefs.setItem(LAST_BACKUP_KEY, T0.toISOString()) // what restoring a file records
    await undoRestore(h.active, T0)
    expect(h.prefs.getItem(LAST_BACKUP_KEY)).toBe('2026-09-01T00:00:00.000Z')
  })
})

describe('restoring on simple storage only', () => {
  it('keeps the safety copy if a failed restore can’t be fully rolled back', async () => {
    const h = await makeLocal()
    // Bills fail both ways: the new value can't be written, nor the old one put back.
    h.failReplaceOn('bills')
    expect(await writeRestore(h.active, incoming(), T0)).toBe(false)
    expect(await readSafetyCopy(h.active.safety, T0)).not.toBeNull()
  })

  it('treats a copy with no data in it as unusable and frees the space', async () => {
    const h = await makeLocal()
    h.prefs.setItem(SAFETY_COPY_KEY, JSON.stringify({ savedAt: T0.toISOString(), schemaVersion: SCHEMA_VERSION }))
    expect(await readSafetyCopy(h.active.safety, T0)).toBeNull()
    expect(h.prefs.getItem(SAFETY_COPY_KEY)).toBeNull()
  })
})

describe('review follow-ups', () => {
  it('leaves out payments and transactions whose loan, bill or goal was left out', () => {
    const r = prepared(file({
      loans: [loan(), loan({ id: 'BAD', startDate: 'soon' })],
      payments: [
        { id: 'p1', loanId: 'L1', amount: 1000, principal: 1000, interest: 0, paidAt: '2026-02-15T00:00:00.000Z', dueDate: '2026-02-15', month: 1 },
        { id: 'p2', loanId: 'BAD', amount: 1000, principal: 1000, interest: 0, paidAt: '2026-02-15T00:00:00.000Z', dueDate: '2026-02-15', month: 1 },
      ],
      billPayments: [{ id: 'bp', billId: 'NOPE', amount: 1, paidAt: '2026-02-15T00:00:00.000Z', dueDate: '2026-02-15' }],
      savingsTransactions: [{ id: 't', goalId: 'NOPE', type: 'deposit', amount: 1, createdAt: '2026-02-15T00:00:00.000Z' }],
    }))
    expect(r.data.payments.map((p) => p.id)).toEqual(['p1'])
    expect(r.data.billPayments).toEqual([])
    expect(r.data.savingsTransactions).toEqual([])
    expect(r.skipped).toBe(4)
  })

})

describe('final review fixes: older safety copies', () => {
  it('a safety copy in the earlier key-by-key format is converted, not thrown away', async () => {
    const h = await makeLocal()
    const values = {
      [STORAGE_FIELDS.loans]: JSON.stringify([loan({ id: 'PRE', name: 'Before restore' })]),
      [STORAGE_FIELDS.monthlyIncome]: '15000',
      [LAST_BACKUP_KEY]: '2026-09-01T00:00:00.000Z',
    }
    h.prefs.setItem(SAFETY_COPY_KEY, JSON.stringify({ savedAt: T0.toISOString(), schemaVersion: SCHEMA_VERSION, values }))
    const copy = await readSafetyCopy(h.active.safety, T0)
    expect(copy?.snapshot.loans.map((l) => l.id)).toEqual(['PRE'])
    expect(copy?.snapshot.monthlyIncome).toBe(15000)
    expect(copy?.prefs[LAST_BACKUP_KEY]).toBe('2026-09-01T00:00:00.000Z')
    expect(await undoRestore(h.active, T0)).toBe(true)
    expect(ids((await h.data()).loans)).toEqual(['PRE'])
  })
})
