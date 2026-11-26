import 'fake-indexeddb/auto'
import { describe, it, expect } from 'vitest'
import { runMove } from './move'
import { fingerprintLegacy } from './fingerprint'
import { createOllieDb, getKv } from './db'
import { createDexieBackend } from './dexieBackend'
import { readLegacySnapshot } from './localStorageBackend'
import { dexieSafetyStore, SAFETY_COPY_KEY } from './safetyCopyStore'
import { toCentavos } from './centavos'
import { memoryStorage } from './testStorage'
import { STORAGE_FIELDS } from '../backup/schema'

// Synthetic records only — never real data.
const loan = (over: Record<string, unknown> = {}) => ({
  id: 'L1', name: 'Phone', color: '#3B82F6', totalAmount: 12000, monthlyPayment: 1000,
  interestRate: 0, durationMonths: 12, startDate: '2026-01-15', monthsPaid: 0, totalPaid: 0,
  totalInterestPaid: 0, createdAt: '2026-01-01T00:00:00.000Z', ...over,
})
const payment = (over: Record<string, unknown> = {}) => ({
  id: 'P1', loanId: 'L1', amount: 1000, principal: 1000, interest: 0,
  paidAt: '2026-02-15T00:00:00.000Z', dueDate: '2026-02-15', month: 1, ...over,
})
const bill = (over: Record<string, unknown> = {}) => ({
  id: 'B1', name: 'Internet', color: '#10B981', category: 'Internet/Phone', amount: 1500,
  nextDueDate: '2026-12-05', createdAt: '2026-01-01T00:00:00.000Z', ...over,
})
const billPayment = (over: Record<string, unknown> = {}) => ({
  id: 'BP1', billId: 'B1', amount: 1500, paidAt: '2026-11-05T00:00:00.000Z', dueDate: '2026-11-05', ...over,
})
const goal = (over: Record<string, unknown> = {}) => ({
  id: 'G1', name: 'Emergency fund', color: '#F59E0B', targetAmount: 50000, currentAmount: 1000,
  createdAt: '2026-01-01T00:00:00.000Z', ...over,
})
const tx = (over: Record<string, unknown> = {}) => ({
  id: 'T1', goalId: 'G1', type: 'deposit', amount: 500, createdAt: '2026-01-01T00:00:00.000Z', ...over,
})

function device(data: Partial<Record<keyof typeof STORAGE_FIELDS, unknown>>) {
  const init: Record<string, string> = {}
  for (const [field, value] of Object.entries(data)) {
    const key = STORAGE_FIELDS[field as keyof typeof STORAGE_FIELDS]
    init[key] = field === 'monthlyIncome' ? String(value) : JSON.stringify(value)
  }
  return memoryStorage(init)
}

const typical = () => device({
  loans: [loan({ monthsPaid: 2, totalPaid: 2000 }), loan({ id: 'L2', name: 'Laptop', monthsPaid: 1, totalPaid: 1000 })],
  payments: [payment(), payment({ id: 'P2', month: 2 }), payment({ id: 'P3', loanId: 'L2' })],
  bills: [bill()],
  billPayments: [billPayment(), billPayment({ id: 'BP2' })],
  savingsGoals: [goal()],
  savingsTransactions: [tx(), tx({ id: 'T2', type: 'withdrawal', amount: 100 })],
  monthlyIncome: 30000,
})

const freshDb = () => createOllieDb(`t-${crypto.randomUUID()}`)
const now = new Date('2026-11-27T08:00:00Z')
const rawKeys = (s: ReturnType<typeof memoryStorage>) => Object.values(STORAGE_FIELDS).map((k) => s.getItem(k))

describe('runMove', () => {
  it('moves an empty device', async () => {
    const db = freshDb()
    const r = await runMove(memoryStorage(), db, { now })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(Object.values(r.report.counts).every((c) => c.source === 0 && c.moved === 0)).toBe(true)
    expect(await getKv(db, 'migration')).toBeTruthy()
    expect(await getKv(db, 'schemaVersion')).toBe(1)
  })

  it('moves a typical device and every record matches', async () => {
    const s = typical()
    const db = freshDb()
    expect((await runMove(s, db, { now })).ok).toBe(true)
    expect(await createDexieBackend(db).readAll()).toEqual(readLegacySnapshot(s))
  })

  it('never changes the old keys', async () => {
    const s = typical()
    const before = rawKeys(s)
    await runMove(s, freshDb(), { now })
    expect(rawKeys(s)).toEqual(before)

    const bad = device({ loans: [loan({ totalAmount: 'abc' })] })
    const badBefore = rawKeys(bad)
    await runMove(bad, freshDb(), { now })
    expect(rawKeys(bad)).toEqual(badBefore)

    const db = freshDb()
    db.loans.hook('reading', (r) => ({ ...r, totalAmount: (r.totalAmount as number) + 1 }))
    await runMove(s, db, { now })
    expect(rawKeys(s)).toEqual(before)
  })

  it('refuses the automatic move when a record would be set aside', async () => {
    const s = device({ loans: [loan(), loan({ id: 'L2', name: 'Bad', totalAmount: 'abc' })] })
    const db = freshDb()
    const r = await runMove(s, db, { now })
    expect(r).toMatchObject({ ok: false, outcome: 'blocked' })
    if (r.ok || r.outcome !== 'blocked') return
    expect(r.items).toHaveLength(1)
    expect(r.items[0]).toMatchObject({ field: 'loans', id: 'L2', name: 'Bad' })
    expect(r.items[0].reason).toMatch(/totalAmount/)
    expect(await db.loans.count()).toBe(0)
    expect(await getKv(db, 'migration')).toBeUndefined()
  })

  it('Move anyway keeps set-aside records apart', async () => {
    const s = device({
      loans: [loan(), loan({ id: 'L2', name: 'Bad', totalAmount: 'abc' })],
      payments: [payment(), payment({ id: 'P9', loanId: 'L2' })],
    })
    const db = freshDb()
    const r = await runMove(s, db, { now, allowQuarantine: true })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.report.quarantined).toBe(2)
    const q = await db.quarantine.toArray()
    expect(q.map((x) => x.id).sort()).toEqual(['L2', 'P9'])
    expect((q.find((x) => x.id === 'L2')!.raw as { totalAmount: unknown }).totalAmount).toBe('abc')
    expect(await db.loans.count()).toBe(1)
  })

  it('sets aside a payment whose loan never existed', async () => {
    const r = await runMove(device({ loans: [loan()], payments: [payment({ loanId: 'GONE' })] }), freshDb(), { now })
    expect(r).toMatchObject({ ok: false, outcome: 'blocked' })
    if (r.ok || r.outcome !== 'blocked') return
    expect(r.items[0].reason).toBe('Its loan is missing')
  })

  it('sets aside the second record with a repeated id', async () => {
    const r = await runMove(device({ bills: [bill(), bill({ name: 'Copy' })] }), freshDb(), { now })
    expect(r).toMatchObject({ ok: false, outcome: 'blocked' })
    if (r.ok || r.outcome !== 'blocked') return
    expect(r.items).toEqual([expect.objectContaining({ field: 'bills', id: 'B1', name: 'Copy', reason: 'Same id as another record' })])
  })

  it('rounds values finer than a centavo and counts them', async () => {
    const s = device({
      loans: [loan({ monthsPaid: 1, totalPaid: 1000.005 })],
      payments: [payment({ amount: 0.1 + 0.2 })],
    })
    const db = freshDb()
    const r = await runMove(s, db, { now })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.report.rounded).toBe(1)
    expect((await db.loans.get('L1'))?.totalPaid).toBe(toCentavos(1000.005))
  })

  it('keeps private loans private', async () => {
    const db = freshDb()
    await runMove(device({ loans: [loan({ private: true })] }), db, { now })
    expect((await createDexieBackend(db).readAll()).loans[0].private).toBe(true)
  })

  it('rebuilds payment history for loans that have none', async () => {
    const db = freshDb()
    const r = await runMove(device({ loans: [loan({ monthsPaid: 2, totalPaid: 2000 })] }), db, { now })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.report.counts.payments.backfilled).toBe(2)
    expect(await db.payments.count()).toBe(2)
  })

  it('keeps order, so undo removes the right payment', async () => {
    const s = device({
      loans: [loan({ monthsPaid: 3, totalPaid: 3000 })],
      payments: [payment({ id: 'P1' }), payment({ id: 'P2', month: 2 }), payment({ id: 'P3', month: 3 })],
    })
    const db = freshDb()
    await runMove(s, db, { now })
    expect((await createDexieBackend(db).readAll()).payments.map((p) => p.id)).toEqual(['P1', 'P2', 'P3'])
  })

  it("running it twice gives the same result, and drops rows the old copy no longer has", async () => {
    const s = typical()
    const db = freshDb()
    await runMove(s, db, { now })
    const first = await createDexieBackend(db).readAll()
    await runMove(s, db, { now, replaceExisting: true })
    expect(await createDexieBackend(db).readAll()).toEqual(first)

    const loans = JSON.parse(s.getItem(STORAGE_FIELDS.loans)!).filter((l: { id: string }) => l.id !== 'L2')
    const payments = JSON.parse(s.getItem(STORAGE_FIELDS.payments)!).filter((p: { loanId: string }) => p.loanId !== 'L2')
    s.setItem(STORAGE_FIELDS.loans, JSON.stringify(loans))
    s.setItem(STORAGE_FIELDS.payments, JSON.stringify(payments))
    await runMove(s, db, { now, replaceExisting: true })
    const after = await createDexieBackend(db).readAll()
    expect(after.loans.map((l) => l.id)).toEqual(['L1'])
    expect(after.bills).toEqual(first.bills)
    expect(after.savingsTransactions).toEqual(first.savingsTransactions)
  })

  it("fails, and says why, when the read-back doesn't match", async () => {
    const db = freshDb()
    db.loans.hook('reading', (r) => ({ ...r, totalAmount: (r.totalAmount as number) + 1 }))
    const r = await runMove(typical(), db, { now })
    expect(r).toMatchObject({ ok: false, outcome: 'failed' })
    if (r.ok || r.outcome !== 'failed') return
    expect(r.reason).toMatch(/loans/)
    expect(await getKv(db, 'migration')).toBeUndefined()
  })

  it('carries the undo-restore copy across', async () => {
    const s = typical()
    const copy = { savedAt: now.toISOString(), schemaVersion: 1, snapshot: readLegacySnapshot(s), prefs: {} }
    s.setItem(SAFETY_COPY_KEY, JSON.stringify(copy))
    const db = freshDb()
    await runMove(s, db, { now })
    expect(await dexieSafetyStore(db).read()).toEqual(copy)
  })
})

describe('fingerprintLegacy', () => {
  it('changes when any old key changes, and not otherwise', () => {
    const s = typical()
    const a = fingerprintLegacy(s)
    expect(fingerprintLegacy(s)).toBe(a)
    for (const key of Object.values(STORAGE_FIELDS)) {
      const t = typical()
      t.setItem(key, (t.getItem(key) ?? '') + ' ')
      expect(fingerprintLegacy(t)).not.toBe(a)
    }
    s.setItem('loan-tracker-theme', 'dark')
    expect(fingerprintLegacy(s)).toBe(a)
  })
})

describe('final review fixes', () => {
  it('a second move does not wipe what the first tab saved after moving', async () => {
    const s = typical()
    const db = freshDb()
    expect((await runMove(s, db, { now })).ok).toBe(true)
    const backend = createDexieBackend(db)
    const before = await backend.readAll()
    const added = { ...before.loans[0], id: 'L3', name: 'Saved in tab A' }
    await backend.write({ loans: { prev: before.loans, next: [...before.loans, added] } })

    // Tab B started before the flag was set and runs the automatic move late.
    const r = await runMove(s, db, { now })
    expect(r).toMatchObject({ ok: false, outcome: 'already-moved' })
    expect((await backend.readAll()).loans.map((l) => l.id)).toContain('L3')
  })

  it('an explicit move replaces what the database holds', async () => {
    const s = typical()
    const db = freshDb()
    await runMove(s, db, { now })
    const r = await runMove(s, db, { now, replaceExisting: true })
    expect(r.ok).toBe(true)
  })

  it('removes a stale undo-restore copy from the database when simple storage has none', async () => {
    const s = typical()
    const db = freshDb()
    await dexieSafetyStore(db).write({ savedAt: now.toISOString(), schemaVersion: 1, snapshot: readLegacySnapshot(s), prefs: {} })
    await runMove(s, db, { now })
    expect(await dexieSafetyStore(db).read()).toBeNull()
  })
})
