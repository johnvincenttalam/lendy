import { describe, it, expect } from 'vitest'
import { buildBackup, checkChecksum } from './envelope'
import { prepareRestore } from './prepareRestore'
import type { DataSnapshot } from '../storage/snapshot'

// Synthetic records only — never real data.
const snapshot = (): DataSnapshot => ({
  loans: [{ id: 'L1', name: 'Phone', color: '#000', totalAmount: 6000, monthlyPayment: 1000, interestRate: 0, durationMonths: 6, startDate: '2026-01-15', monthsPaid: 1, totalPaid: 1000, totalInterestPaid: 0, createdAt: '2026-01-01T00:00:00.000Z', private: true }],
  payments: [{ id: 'P1', loanId: 'L1', amount: 1000, principal: 1000, interest: 0, paidAt: '2026-02-15T00:00:00.000Z', dueDate: '2026-02-15', month: 1 }],
  monthlyIncome: 30000,
  bills: [{ id: 'B1', name: 'Internet', color: '#000', category: 'Other', amount: 1500, nextDueDate: '2026-12-05', createdAt: '2026-01-01T00:00:00.000Z' }],
  billPayments: [],
  savingsGoals: [{ id: 'G1', name: 'Fund', color: '#000', targetAmount: 5000, currentAmount: 0, createdAt: '2026-01-01T00:00:00.000Z' }],
  savingsTransactions: [],
})
const folder = { name: 'Side', pinHash: 'abc', recoveryHash: null }
const exportedAt = '2026-11-27T08:00:00.000Z'

const build = (over: Partial<Parameters<typeof buildBackup>[0]> = {}) =>
  buildBackup({ snapshot: snapshot(), schemaVersion: 1, appVersion: '9.9.9', exportedAt, privateFolder: folder, ...over })

function ok(json: string) {
  const r = prepareRestore(json)
  if (!r.ok) throw new Error(r.reason)
  return r
}

describe('the v2 backup file', () => {
  it('a backup round-trips: build, then prepareRestore reads the same records', async () => {
    const r = ok(await build())
    const s = snapshot()
    expect(r.data.loans).toEqual(s.loans)
    expect(r.data.payments).toEqual(s.payments)
    expect(r.data.bills).toEqual(s.bills)
    expect(r.data.savingsGoals).toEqual(s.savingsGoals)
    expect(r.data.monthlyIncome).toBe(30000)
    expect(r.data.privateFolder).toEqual(folder)
    expect(r.info).toEqual({ formatVersion: 2, appVersion: '9.9.9', exportedAt, unknownSections: false, setAside: 0 })
    expect(r.rebuiltPayments).toBe(false)
  })

  it('the checksum checks out on an untouched file', async () => {
    expect(await checkChecksum(JSON.parse(await build()))).toBe('ok')
  })

  it('the checksum still checks out after re-saving with other spacing', async () => {
    const resaved = JSON.stringify(JSON.parse(await build()), null, 4).replace(/\n/g, '\r\n')
    expect(await checkChecksum(JSON.parse(resaved))).toBe('ok')
  })

  it('an edited amount makes the checksum mismatch', async () => {
    const raw = JSON.parse(await build())
    raw.data.loans.loans[0].totalAmount = 9000
    expect(await checkChecksum(raw)).toBe('mismatch')
  })

  it('a v2 file without a checksum is flagged missing; an older file has none', async () => {
    const raw = JSON.parse(await build())
    delete raw.checksum
    expect(await checkChecksum(raw)).toBe('missing')
    expect(await checkChecksum({ schemaVersion: 1, loans: [] })).toBe('none')
  })

  it('a newer format is refused', async () => {
    const raw = JSON.parse(await build())
    raw.formatVersion = 3
    expect(prepareRestore(JSON.stringify(raw))).toEqual({ ok: false, reason: 'newer' })
  })

  it('unknown sections are ignored and flagged', async () => {
    const raw = JSON.parse(await build())
    raw.data.vault = { items: [1] }
    const r = ok(JSON.stringify(raw))
    expect(r.info.unknownSections).toBe(true)
    expect(r.data.loans).toHaveLength(1)
  })

  it('set-aside records are counted, not imported', async () => {
    const r = ok(await build({ setAside: [{ id: 'X' }, { id: 'Y' }] }))
    expect(r.info.setAside).toBe(2)
    expect(r.data.loans.map((l) => l.id)).toEqual(['L1'])
  })

  it('a file whose loans section is missing is invalid', async () => {
    const raw = JSON.parse(await build())
    delete raw.data.loans
    expect(prepareRestore(JSON.stringify(raw))).toEqual({ ok: false, reason: 'invalid' })
  })

  it('v0 and v1 files report their version, and v0 payment history is rebuilt', () => {
    const v1 = ok(JSON.stringify({ schemaVersion: 1, loans: [], payments: [] }))
    expect(v1.info).toEqual({ formatVersion: 1, appVersion: null, exportedAt: null, unknownSections: false, setAside: 0 })
    const v0 = ok(JSON.stringify({ loans: [{ ...snapshot().loans[0], private: undefined }] }))
    expect(v0.info.formatVersion).toBe(0)
    expect(v0.rebuiltPayments).toBe(true)
    expect(v0.data.payments).toHaveLength(1)
  })
})
