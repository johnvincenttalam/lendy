import { describe, it, expect } from 'vitest'
import { prepareRestore, writeRestore, undoRestore, readSafetyCopy, SAFETY_COPY_KEY } from './restore'
import type { RestoreData } from './restore'
import { STORAGE_FIELDS } from './schema'

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
    const copy = readSafetyCopy(s)
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

describe('undoRestore', () => {
  it('puts back what was there before the restore', () => {
    const s = deviceWithData()
    writeRestore(s, incoming(), new Date())
    expect(undoRestore(s)).toBe(true)
    expect(loansIn(s)).toEqual(['OLD'])
    expect(s.getItem(STORAGE_FIELDS.savingsGoals)).toBeNull()
    expect(s.getItem(STORAGE_FIELDS.monthlyIncome)).toBe('20000')
  })

  it('can only be used once', () => {
    const s = deviceWithData()
    writeRestore(s, incoming(), new Date())
    undoRestore(s)
    expect(readSafetyCopy(s)).toBeNull()
    expect(undoRestore(s)).toBe(false)
  })
})
