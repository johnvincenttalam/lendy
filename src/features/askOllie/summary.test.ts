import { describe, it, expect } from 'vitest'
import type { Loan } from '../loans/loanTypes'
import type { Bill } from '../bills/billTypes'
import type { SavingsGoal } from '../savings/savingsTypes'
import { formatCurrency, remainingBalance } from '../loans/loanUtils'
import { buildSummary } from './summary'
import type { SummaryInput } from './summary'

const NOW = new Date(2026, 10, 24, 10)

function makeLoan(overrides: Partial<Loan> = {}): Loan {
  return {
    id: 'loan-1', name: 'Phone', color: '#F3622D', totalAmount: 12000, monthlyPayment: 1000,
    interestRate: 0, durationMonths: 12, startDate: '2026-06-01', monthsPaid: 4, totalPaid: 4000,
    totalInterestPaid: 0, createdAt: '2026-01-01T00:00:00.000Z', ...overrides,
  }
}

function makeBill(overrides: Partial<Bill> = {}): Bill {
  return {
    id: 'bill-1', name: 'Internet', color: '#000', category: 'Internet/Phone', amount: 1500,
    nextDueDate: '2026-12-05', createdAt: '2026-01-01T00:00:00.000Z', ...overrides,
  }
}

function makeGoal(overrides: Partial<SavingsGoal> = {}): SavingsGoal {
  return {
    id: 'goal-1', name: 'Emergency fund', color: '#000', targetAmount: 10000, currentAmount: 2500,
    createdAt: '2026-01-01T00:00:00.000Z', ...overrides,
  }
}

function input(overrides: Partial<SummaryInput> = {}): SummaryInput {
  return {
    loans: [], payments: [], bills: [], billPayments: [], goals: [],
    monthlyIncome: 0, includePrivate: false, folderName: null, ...overrides,
  }
}

const phone = makeLoan()
const secret = makeLoan({ id: 'loan-2', name: 'Secret Car', totalAmount: 90000, monthlyPayment: 5000, durationMonths: 18, private: true })

describe('buildSummary', () => {
  it('leaves private loans and the folder name out unless asked', () => {
    const text = buildSummary(input({ loans: [phone, secret], folderName: 'Receipts' }), NOW)
    expect(text).toContain('Phone')
    expect(text).not.toContain('Secret Car')
    expect(text).not.toContain('Receipts')
  })

  it('adds private loans in their own block when asked', () => {
    const text = buildSummary(input({ loans: [phone, secret], folderName: 'Receipts', includePrivate: true }), NOW)
    expect(text).toContain('Secret Car')
    expect(text).toContain('Receipts')
    expect(text).toContain(`Total left to pay (regular loans): ${formatCurrency(remainingBalance(phone))}`)
  })

  it('gives the figures behind a "should I borrow more?" question', () => {
    const upToDate = makeLoan({ id: 'loan-3', name: 'Laptop', monthlyPayment: 2000, monthsPaid: 6, totalPaid: 6000 })
    const text = buildSummary(input({ loans: [phone, upToDate, secret], monthlyIncome: 20000 }), NOW)
    expect(text).toContain('Monthly loan payments as a share of monthly income (regular loans): 15%')
    expect(text).toContain('Overdue regular loans: 1 (Phone)')
  })

  it('gives a quick read: headroom, what frees up next, overdue bills', () => {
    // Phone: ₱1,000/month ending 2027-06-01. Laptop: ₱7,500/month ending 2027-09-01.
    const laptop = makeLoan({ id: 'loan-3', name: 'Laptop', monthlyPayment: 7500, durationMonths: 15 })
    const text = buildSummary(input({
      loans: [phone, laptop],
      monthlyIncome: 20000,
      bills: [makeBill({ name: 'Water', nextDueDate: '2020-01-01' })],
    }), NOW)
    expect(text).toContain(`Comfortable limit for monthly loan payments (40% of the ${formatCurrency(20000)} income setting): ${formatCurrency(8000)}`)
    expect(text).toContain(`Monthly loan payments are over that limit by ${formatCurrency(500)}`)
    // Both loans are behind (next due 2026-10-01), so their finish is projected from today.
    expect(text).toContain(`Next loan to finish: Phone, last payment 2027-06-24, freeing ${formatCurrency(1000)} a month from 2027-07-24 (estimated: behind schedule) (monthly loan payments after that: ${formatCurrency(7500)})`)
    expect(text).toContain(`Monthly loan payments ahead: from 2027-07-24 ${formatCurrency(7500)} (Phone done, estimated); from 2027-10-24 ${formatCurrency(0)} (Laptop done, estimated)`)
    expect(text).toContain(`Monthly loan payments drop under the comfortable limit from 2027-07-24 (after Phone), leaving ${formatCurrency(500)} of room`)
    expect(text).toContain('Overdue bills: 1 (Water)')
    expect(text).toContain('last payment 2027-09-24 (estimated: behind schedule')
  })

  it('shows room left, and says when no income is set', () => {
    const withIncome = buildSummary(input({ loans: [phone], monthlyIncome: 20000 }), NOW)
    expect(withIncome).toContain(`Room left under that limit: ${formatCurrency(7000)} a month`)
    expect(withIncome).toContain('Overdue bills: none')
    const without = buildSummary(input({ loans: [phone] }), NOW)
    expect(without).toContain('No monthly income is set in Settings')
  })

  it('leaves the income share out without an income and says when nothing is overdue', () => {
    const upToDate = makeLoan({ monthsPaid: 6, totalPaid: 6000 })
    const text = buildSummary(input({ loans: [upToDate] }), NOW)
    expect(text).not.toContain('share of monthly income')
    expect(text).toContain('Overdue regular loans: none')
  })

  it('ranks loans by remaining balance', () => {
    const big = makeLoan({ id: 'big', name: 'Big TV', totalAmount: 50000, monthlyPayment: 5000, durationMonths: 10, monthsPaid: 0, totalPaid: 0 })
    const text = buildSummary(input({ loans: [phone, big] }), NOW)
    expect(text).toContain('Largest remaining balance: Big TV')
    expect(text).toContain('Smallest remaining balance: Phone')
  })

  it('marks archived items', () => {
    const text = buildSummary(input({
      loans: [makeLoan({ name: 'Old Loan', archived: true })],
      bills: [makeBill({ name: 'Old Bill', archived: true })],
      goals: [makeGoal({ name: 'Old Goal', archived: true })],
    }), NOW)
    for (const name of ['Old Loan', 'Old Bill', 'Old Goal']) {
      const line = text.split('\n').find((l) => l.includes(name))
      expect(line).toContain('archived')
    }
  })
})
