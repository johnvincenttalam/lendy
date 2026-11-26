import { describe, it, expect } from 'vitest'
import { writeRestore, undoRestore, readSafetyCopy, SAFETY_COPY_KEY } from './restore'
import { prepareRestore } from './prepareRestore'
import type { RestoreData } from './restore'
import { SCHEMA_VERSION, STORAGE_FIELDS } from './schema'
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

class MemoryStorage {
  map = new Map<string, string>()
  failOnSet: ((key: string) => boolean) | null = null
  getItem(key: string) { return this.map.has(key) ? this.map.get(key)! : null }
  setItem(key: string, value: string) {
    if (this.failOnSet?.(key)) throw new Error('QuotaExceededError')
    this.map.set(key, value)
  }
  removeItem(key: string) { this.map.delete(key) }
}

function deviceWithData() {
  const s = new MemoryStorage()
  s.setItem(STORAGE_FIELDS.loans, JSON.stringify([loan({ id: 'OLD', name: 'Old loan' })]))
  s.setItem(STORAGE_FIELDS.bills, JSON.stringify([bill({ id: 'OLDB' })]))
  s.setItem(STORAGE_FIELDS.monthlyIncome, '20000')
  return s
}

const incoming = (): RestoreData => prepared(file()).data
const loansIn = (s: MemoryStorage) => JSON.parse(s.getItem(STORAGE_FIELDS.loans) ?? '[]').map((l: { id: string }) => l.id)

describe('writeRestore', () => {
  it('replaces every section on the device', () => {
    const s = deviceWithData()
    expect(writeRestore(s, incoming(), new Date('2026-11-26T10:00:00Z'))).toBe(true)
    expect(loansIn(s)).toEqual(['L1'])
    expect(JSON.parse(s.getItem(STORAGE_FIELDS.bills)!).map((b: { id: string }) => b.id)).toEqual(['B1'])
    expect(s.getItem(STORAGE_FIELDS.monthlyIncome)).toBe('30000')
  })

  it('keeps a safety copy of what was there before', () => {
    const s = deviceWithData()
    writeRestore(s, incoming(), new Date('2026-11-26T10:00:00Z'))
    const copy = readSafetyCopy(s, new Date('2026-11-26T10:05:00Z'))
    expect(copy?.savedAt).toBe('2026-11-26T10:00:00.000Z')
    expect(JSON.parse(copy!.values[STORAGE_FIELDS.loans]!)[0].id).toBe('OLD')
  })

  it('leaves the income as it was when the file has none', () => {
    const s = deviceWithData()
    writeRestore(s, { ...incoming(), monthlyIncome: null }, new Date())
    expect(s.getItem(STORAGE_FIELDS.monthlyIncome)).toBe('20000')
  })

  it('changes nothing if one part fails to save', () => {
    const s = deviceWithData()
    s.failOnSet = (key) => key === STORAGE_FIELDS.savingsGoals
    expect(writeRestore(s, incoming(), new Date())).toBe(false)
    expect(loansIn(s)).toEqual(['OLD'])
    expect(JSON.parse(s.getItem(STORAGE_FIELDS.bills)!)[0].id).toBe('OLDB')
    expect(s.getItem(STORAGE_FIELDS.savingsGoals)).toBeNull()
  })

  it('changes nothing if the safety copy cannot be kept', () => {
    const s = deviceWithData()
    s.failOnSet = (key) => key === SAFETY_COPY_KEY
    expect(writeRestore(s, incoming(), new Date())).toBe(false)
    expect(loansIn(s)).toEqual(['OLD'])
  })
})

const T0 = new Date('2026-11-26T10:00:00Z')
const days = (n: number) => new Date(T0.getTime() + n * 86_400_000)

describe('undoRestore', () => {
  it('puts back what was there before the restore', () => {
    const s = deviceWithData()
    writeRestore(s, incoming(), T0)
    expect(undoRestore(s, T0)).toBe(true)
    expect(loansIn(s)).toEqual(['OLD'])
    expect(s.getItem(STORAGE_FIELDS.savingsGoals)).toBeNull()
    expect(s.getItem(STORAGE_FIELDS.monthlyIncome)).toBe('20000')
  })

  it('can only be used once', () => {
    const s = deviceWithData()
    writeRestore(s, incoming(), T0)
    undoRestore(s, T0)
    expect(readSafetyCopy(s, T0)).toBeNull()
    expect(undoRestore(s, T0)).toBe(false)
  })
})

describe('safety copy limits', () => {
  it('keeps the safety copy and says so when putting the old data back fails', () => {
    const s = deviceWithData()
    writeRestore(s, incoming(), T0)
    s.failOnSet = (key) => key === STORAGE_FIELDS.loans
    expect(undoRestore(s, T0)).toBe(false)
    expect(readSafetyCopy(s, T0)).not.toBeNull()
  })

  it('keeps the safety copy if a failed restore can’t be fully rolled back', () => {
    const s = deviceWithData()
    // Bills fail both ways: the new value can't be written, nor the old one put back.
    s.failOnSet = (key) => key === STORAGE_FIELDS.bills
    expect(writeRestore(s, incoming(), T0)).toBe(false)
    expect(readSafetyCopy(s, T0)).not.toBeNull()
  })

  it('records the data version it was saved with', () => {
    const s = deviceWithData()
    writeRestore(s, incoming(), T0)
    expect(readSafetyCopy(s, T0)?.schemaVersion).toBe(SCHEMA_VERSION)
  })

  it('stops offering an undo after 7 days, and frees the space', () => {
    const s = deviceWithData()
    writeRestore(s, incoming(), T0)
    expect(readSafetyCopy(s, days(7))).not.toBeNull()
    expect(readSafetyCopy(s, days(8))).toBeNull()
    expect(s.getItem(SAFETY_COPY_KEY)).toBeNull()
    expect(undoRestore(s, days(8))).toBe(false)
    expect(loansIn(s)).toEqual(['L1'])
  })

  it('won’t put back data saved by a different version of Ollie', () => {
    const s = deviceWithData()
    s.setItem(SAFETY_COPY_KEY, JSON.stringify({ savedAt: T0.toISOString(), schemaVersion: SCHEMA_VERSION - 1, values: {} }))
    expect(readSafetyCopy(s, T0)).toBeNull()
    expect(undoRestore(s, T0)).toBe(false)
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

  it('puts back the last-backup date on undo, so the backup reminder comes back', () => {
    const s = deviceWithData()
    s.setItem(LAST_BACKUP_KEY, '2026-09-01T00:00:00.000Z')
    writeRestore(s, incoming(), T0)
    s.setItem(LAST_BACKUP_KEY, T0.toISOString()) // what restoring a file records
    undoRestore(s, T0)
    expect(s.getItem(LAST_BACKUP_KEY)).toBe('2026-09-01T00:00:00.000Z')
  })
})
