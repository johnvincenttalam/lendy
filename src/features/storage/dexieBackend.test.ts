import 'fake-indexeddb/auto'
import { describe, it, expect, vi } from 'vitest'
import { createOllieDb, getKv, setKv } from './db'
import { createDexieBackend, upgradeDexieData } from './dexieBackend'
import { ReplaceAllError } from './backend'
import type { DataSnapshot } from './snapshot'
import type { Loan, PaymentRecord } from '../loans/loanTypes'
import type { Snapshot } from '../backup/schema'

// Synthetic records only — never real data.
const loan = (id: string, over: Partial<Loan> = {}): Loan => ({
  id, name: `Loan ${id}`, color: '#000', totalAmount: 12000.5, monthlyPayment: 1000, interestRate: 0,
  durationMonths: 12, startDate: '2026-01-15', monthsPaid: 0, totalPaid: 0, totalInterestPaid: 0,
  createdAt: '2026-01-01T00:00:00.000Z', ...over,
})
const payment = (id: string, loanId: string): PaymentRecord => ({
  id, loanId, amount: 1000, principal: 1000, interest: 0, paidAt: '2026-02-15T00:00:00.000Z', dueDate: '2026-02-15', month: 1,
})

const snapshot = (): DataSnapshot => ({
  loans: [loan('L2'), { ...loan('L1'), extra: 'kept' } as Loan],
  payments: [payment('P1', 'L1')],
  monthlyIncome: 30000,
  bills: [{ id: 'B1', name: 'Internet', color: '#000', category: 'Other', amount: 1499.99, nextDueDate: '2026-12-05', createdAt: '2026-01-01T00:00:00.000Z' }],
  billPayments: [{ id: 'BP1', billId: 'B1', amount: 1499.99, paidAt: '2026-11-05T00:00:00.000Z', dueDate: '2026-11-05' }],
  savingsGoals: [{ id: 'G1', name: 'Fund', color: '#000', targetAmount: 50000, currentAmount: 1234.56, createdAt: '2026-01-01T00:00:00.000Z' }],
  savingsTransactions: [{ id: 'T1', goalId: 'G1', type: 'deposit', amount: 1234.56, createdAt: '2026-01-01T00:00:00.000Z' }],
})

const freshDb = () => createOllieDb(`t-${crypto.randomUUID()}`)

describe('database backend', () => {
  it('round-trips a snapshot through replaceAll and readAll', async () => {
    const backend = createDexieBackend(freshDb())
    await backend.replaceAll(snapshot())
    expect(await backend.readAll()).toEqual(snapshot())
  })

  it('stores money as whole centavos', async () => {
    const db = freshDb()
    await createDexieBackend(db).replaceAll(snapshot())
    expect((await db.loans.get('L1'))?.totalAmount).toBe(1200050)
    expect(await getKv(db, 'monthlyIncome')).toBe(3000000)
  })

  it('write puts changed records, deletes removed ones and leaves the rest alone', async () => {
    const db = freshDb()
    const backend = createDexieBackend(db)
    const A = loan('A'), B = loan('B'), C = loan('C')
    await backend.replaceAll({ ...snapshot(), loans: [A, B, C] })
    const B2 = { ...B, name: 'x' }
    const D = loan('D')
    const put = vi.spyOn(db.loans, 'bulkPut')
    await backend.write({ loans: { prev: [A, B, C], next: [A, B2, D] } })
    const loans = (await backend.readAll()).loans
    expect(loans.map((l) => l.id)).toEqual(['A', 'B', 'D'])
    expect(loans[1].name).toBe('x')
    const written = put.mock.calls.flatMap((c) => c[0] as readonly { id: string }[]).map((r) => r.id)
    expect(written).not.toContain('A')
    expect(written.sort()).toEqual(['B', 'D'])
  })

  it('new records go to the end, changed records keep their place', async () => {
    const db = freshDb()
    const backend = createDexieBackend(db)
    const A = loan('A'), B = loan('B')
    await backend.replaceAll({ ...snapshot(), loans: [A, B] })
    const B2 = { ...B, name: 'x' }
    const D = loan('D')
    await backend.write({ loans: { prev: [A, B], next: [A, B2, D] } })
    const bRow = await db.loans.get('B')
    const dRow = await db.loans.get('D')
    expect(bRow?._seq).toBe(1)
    expect(dRow!._seq).toBeGreaterThan(bRow!._seq)
    expect((await backend.readAll()).loans.map((l) => l.id)).toEqual(['A', 'B', 'D'])
  })

  it('write is all or nothing across tables', async () => {
    const db = freshDb()
    const backend = createDexieBackend(db)
    await backend.replaceAll(snapshot())
    const before = await backend.readAll()
    db.payments.hook('creating', () => { throw new Error('boom') })
    const L3 = loan('L3')
    const P9 = payment('P9', 'L3')
    await expect(backend.write({
      loans: { prev: before.loans, next: [...before.loans, L3] },
      payments: { prev: before.payments, next: [...before.payments, P9] },
    })).rejects.toThrow()
    const after = await backend.readAll()
    expect(after.loans.map((l) => l.id)).not.toContain('L3')
    expect(after.payments.map((p) => p.id)).not.toContain('P9')
  })

  it('replaceAll is all or nothing', async () => {
    const db = freshDb()
    const backend = createDexieBackend(db)
    await backend.replaceAll(snapshot())
    db.savingsGoals.hook('creating', () => { throw new Error('boom') })
    const err = await backend.replaceAll({ ...snapshot(), loans: [loan('NEW')] }).catch((e) => e)
    expect(err).toBeInstanceOf(ReplaceAllError)
    expect(err.rolledBack).toBe(true)
    expect(await backend.readAll()).toEqual(snapshot())
  })

  const tagAll = { 2: (s: Snapshot) => ({ ...s, loans: (s.loans as Loan[]).map((l) => ({ ...l, tag: 'migrated' })) }) }

  it('upgradeDexieData runs the migration chain on database data', async () => {
    const db = freshDb()
    const backend = createDexieBackend(db)
    await backend.replaceAll(snapshot())
    await setKv(db, 'schemaVersion', 1)
    expect(await upgradeDexieData(db, tagAll, 2)).toBe(true)
    const loans = (await backend.readAll()).loans
    expect(loans.every((l) => l.tag === 'migrated')).toBe(true)
    expect(await getKv(db, 'schemaVersion')).toBe(2)
    expect(await upgradeDexieData(db, tagAll, 2)).toBe(false)
  })

  it('upgradeDexieData leaves newer data alone', async () => {
    const db = freshDb()
    const backend = createDexieBackend(db)
    await backend.replaceAll(snapshot())
    await setKv(db, 'schemaVersion', 3)
    expect(await upgradeDexieData(db, tagAll, 2)).toBe(false)
    expect(await backend.readAll()).toEqual(snapshot())
  })
})
