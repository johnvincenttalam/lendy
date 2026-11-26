import { describe, it, expect } from 'vitest'
import { createLocalStorageBackend, readLegacySnapshot } from './localStorageBackend'
import { ReplaceAllError } from './backend'
import { memoryStorage } from './testStorage'
import { STORAGE_FIELDS } from '../backup/schema'
import type { DataSnapshot } from './snapshot'
import type { Bill } from '../bills/billTypes'

// Synthetic records only — never real data.
const loan = { id: 'L1', name: 'Phone', color: '#000', totalAmount: 6000, monthlyPayment: 1000, interestRate: 0, durationMonths: 6, startDate: '2026-01-15', monthsPaid: 0, totalPaid: 0, totalInterestPaid: 0, createdAt: '2026-01-01T00:00:00.000Z' }
const bill: Bill = { id: 'B1', name: 'Internet', color: '#000', category: 'Other', amount: 1500, nextDueDate: '2026-12-05', createdAt: '2026-01-01T00:00:00.000Z' }

const snapshot = (): DataSnapshot => ({
  loans: [loan], payments: [], monthlyIncome: 30000, bills: [bill], billPayments: [],
  savingsGoals: [{ id: 'G1', name: 'Fund', color: '#000', targetAmount: 5000, currentAmount: 0, createdAt: '2026-01-01T00:00:00.000Z' }],
  savingsTransactions: [],
})

function seeded() {
  return memoryStorage({
    [STORAGE_FIELDS.loans]: JSON.stringify([{ id: 'OLD', name: 'Old' }]),
    [STORAGE_FIELDS.bills]: JSON.stringify([{ id: 'OLDB' }]),
    [STORAGE_FIELDS.monthlyIncome]: '20000',
  })
}

describe('localStorage backend', () => {
  it("reads today's keys, filling loan defaults", () => {
    const s = memoryStorage({
      [STORAGE_FIELDS.loans]: JSON.stringify([{ id: 'L1', name: 'Phone', totalAmount: 6000 }]),
      [STORAGE_FIELDS.monthlyIncome]: '30000',
    })
    const snap = readLegacySnapshot(s)
    expect(snap.loans[0]).toMatchObject({ color: '#F3622D', interestRate: 0, totalInterestPaid: 0 })
    expect(snap.monthlyIncome).toBe(30000)
  })

  it('treats unreadable or missing keys as empty', () => {
    const s = memoryStorage({ [STORAGE_FIELDS.bills]: '{not json', [STORAGE_FIELDS.payments]: '{"a":1}' })
    const snap = readLegacySnapshot(s)
    expect(snap.bills).toEqual([])
    expect(snap.payments).toEqual([])
    expect(snap.loans).toEqual([])
    expect(snap.monthlyIncome).toBe(0)
  })

  it('write saves only the fields in the change', async () => {
    const s = seeded()
    const before = s.getItem(STORAGE_FIELDS.loans)
    await createLocalStorageBackend(s).write({ bills: { next: [bill], prev: [] } })
    expect(s.getItem(STORAGE_FIELDS.loans)).toBe(before)
    expect(JSON.parse(s.getItem(STORAGE_FIELDS.bills)!)).toEqual([bill])
  })

  it('write stores the income as plain text', async () => {
    const s = seeded()
    await createLocalStorageBackend(s).write({ monthlyIncome: { next: 25000, prev: 20000 } })
    expect(s.getItem(STORAGE_FIELDS.monthlyIncome)).toBe('25000')
  })

  it('replaceAll writes every field', async () => {
    const s = seeded()
    const backend = createLocalStorageBackend(s)
    await backend.replaceAll(snapshot())
    expect(await backend.readAll()).toEqual(snapshot())
  })

  it('replaceAll puts everything back when one key fails, and says it rolled back', async () => {
    const s = seeded()
    const before = Object.values(STORAGE_FIELDS).map((k) => s.getItem(k))
    s.failOnSet = (k) => k === STORAGE_FIELDS.savingsGoals
    const err = await createLocalStorageBackend(s).replaceAll(snapshot()).catch((e) => e)
    expect(err).toBeInstanceOf(ReplaceAllError)
    expect(err.rolledBack).toBe(true)
    expect(Object.values(STORAGE_FIELDS).map((k) => s.getItem(k))).toEqual(before)
  })

  it("replaceAll says so when it can't put everything back", async () => {
    const s = seeded()
    let failing = false
    s.failOnSet = (k) => {
      if (k === STORAGE_FIELDS.savingsGoals) failing = true
      return failing
    }
    const err = await createLocalStorageBackend(s).replaceAll(snapshot()).catch((e) => e)
    expect(err).toBeInstanceOf(ReplaceAllError)
    expect(err.rolledBack).toBe(false)
  })
})
