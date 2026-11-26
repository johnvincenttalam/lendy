import { describe, it, expect } from 'vitest'
import { toRow, fromRow, hasSubCentavo } from './centavos'
import { RECORD_FIELDS } from './snapshot'
import type { RecordField } from './snapshot'

// Synthetic records only — never real data.
const samples: Record<RecordField, Record<string, unknown>> = {
  loans: { id: 'L1', name: 'Phone', color: '#000', totalAmount: 12000.5, monthlyPayment: 1000.25, interestRate: 4.95, durationMonths: 12, startDate: '2026-01-15', monthsPaid: 1, totalPaid: 1000.25, totalInterestPaid: 12.34, createdAt: '2026-01-01T00:00:00.000Z' },
  payments: { id: 'P1', loanId: 'L1', amount: 1000.25, principal: 987.91, interest: 12.34, paidAt: '2026-02-15T00:00:00.000Z', dueDate: '2026-02-15', month: 1 },
  bills: { id: 'B1', name: 'Internet', color: '#000', category: 'Other', amount: 1499.99, nextDueDate: '2026-12-05', createdAt: '2026-01-01T00:00:00.000Z' },
  billPayments: { id: 'BP1', billId: 'B1', amount: 1499.99, paidAt: '2026-11-05T00:00:00.000Z', dueDate: '2026-11-05' },
  savingsGoals: { id: 'G1', name: 'Fund', color: '#000', targetAmount: 50000, currentAmount: 1234.56, createdAt: '2026-01-01T00:00:00.000Z' },
  savingsTransactions: { id: 'T1', goalId: 'G1', type: 'deposit', amount: 1234.56, createdAt: '2026-01-01T00:00:00.000Z' },
}

describe('centavo conversion', () => {
  it('toRow converts every money field of a loan to centavos and keeps other fields', () => {
    const row = toRow('loans', { id: 'L1', name: 'Phone', totalAmount: 12000.5, monthlyPayment: 1000, totalPaid: 0.1 + 0.2, totalInterestPaid: 0, interestRate: 4.95, extra: 'kept' }, 3)
    expect(row).toEqual({ id: 'L1', name: 'Phone', totalAmount: 1200050, monthlyPayment: 100000, totalPaid: 30, totalInterestPaid: 0, interestRate: 4.95, extra: 'kept', _seq: 3 })
  })

  it('fromRow round-trips every field of every record type', () => {
    for (const field of RECORD_FIELDS) {
      expect(fromRow(field, toRow(field, samples[field], 0))).toEqual(samples[field])
    }
  })

  it('fromRow does not change the stored row', () => {
    const row = toRow('loans', samples.loans, 7)
    const before = structuredClone(row)
    fromRow('loans', row)
    expect(row).toEqual(before)
  })

  it('hasSubCentavo spots values finer than a centavo', () => {
    expect(hasSubCentavo(1000)).toBe(false)
    expect(hasSubCentavo(0.1 + 0.2)).toBe(false)
    expect(hasSubCentavo(12.34)).toBe(false)
    expect(hasSubCentavo(1000.005)).toBe(true)
    expect(hasSubCentavo(0.001)).toBe(true)
  })

  it('toRow leaves a money field that is not a number untouched', () => {
    const row = toRow('loans', { id: 'L1', totalAmount: undefined }, 0)
    expect(row.totalAmount).toBeUndefined()
  })
})
