import { describe, it, expect } from 'vitest'
import type { Loan } from '../loans/loanTypes'
import { getPaymentStatus } from './notificationUtils'

function isoOffset(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function makeLoan(overrides: Partial<Loan> = {}): Loan {
  return {
    id: 'loan-1', name: 'Phone', color: '#F3622D', totalAmount: 12000, monthlyPayment: 1000,
    interestRate: 0, durationMonths: 12, startDate: isoOffset(0), monthsPaid: 0, totalPaid: 0,
    totalInterestPaid: 0, createdAt: '2026-01-01T00:00:00.000Z', ...overrides,
  }
}

describe('getPaymentStatus', () => {
  it('reminds about a public loan due today or overdue', () => {
    expect(getPaymentStatus([makeLoan()], 3, true, true)).toHaveLength(1)
    expect(getPaymentStatus([makeLoan({ startDate: isoOffset(-40) })], 3, true, true)).toHaveLength(1)
  })

  it('never reminds about a private loan', () => {
    expect(getPaymentStatus([makeLoan({ private: true })], 3, true, true)).toEqual([])
    expect(getPaymentStatus([makeLoan({ startDate: isoOffset(-40), private: true })], 3, true, true)).toEqual([])
  })
})
