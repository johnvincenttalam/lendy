import { describe, it, expect } from 'vitest'
import type { Loan } from '../loans/loanTypes'
import type { Bill } from '../bills/billTypes'
import type { SavingsGoal } from '../savings/savingsTypes'
import type { MoneyEntry } from '../money/moneyTypes'
import { formatCurrency, remainingBalance } from '../loans/loanUtils'
import { localISODate } from '../money/moneyUtils'
import { buildSummary, SUMMARY_CHAR_BUDGET } from './summary'
import type { SummaryInput } from './summary'

const NOW = new Date(2026, 10, 24, 10)

function daysAgo(n: number): string {
  const d = new Date(NOW)
  d.setDate(d.getDate() - n)
  return localISODate(d)
}

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

let entryId = 0
function makeEntry(overrides: Partial<MoneyEntry> = {}): MoneyEntry {
  entryId += 1
  return {
    id: `e${entryId}`, type: 'expense', amount: 100, categoryId: 'exp-food', date: daysAgo(1),
    createdAt: '2026-11-01T00:00:00.000Z', ...overrides,
  }
}

function input(overrides: Partial<SummaryInput> = {}): SummaryInput {
  return {
    loans: [], payments: [], bills: [], billPayments: [], goals: [], moneyEntries: [],
    moneyCategories: [], monthlyIncome: 0, includePrivate: false, folderName: null, ...overrides,
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

  it('totals spending per category per month', () => {
    const text = buildSummary(input({
      moneyEntries: [
        makeEntry({ amount: 100, date: '2026-11-03' }),
        makeEntry({ amount: 250, date: '2026-11-10' }),
        makeEntry({ amount: 999, date: '2026-10-10' }),
      ],
    }), NOW)
    const november = text.split('\n').find((l) => l.startsWith('2026-11'))
    expect(november).toContain(`Food ${formatCurrency(350)}`)
  })

  it('lists recent entries and drops old ones', () => {
    const text = buildSummary(input({
      moneyEntries: [
        makeEntry({ amount: 77, date: daysAgo(5), note: 'jollibee lunch' }),
        makeEntry({ amount: 88, date: daysAgo(70), note: 'old dinner' }),
      ],
    }), NOW)
    expect(text).toContain('jollibee lunch')
    expect(text).not.toContain('old dinner')
  })

  it('stays within budget by trimming money history first', () => {
    const entries = Array.from({ length: 3000 }, (_, i) =>
      makeEntry({ amount: 10 + i, date: daysAgo(i % 360), note: `a fairly long note number ${i}`, categoryId: i % 2 ? 'exp-food' : 'exp-transport' }))
    const loans = [phone, makeLoan({ id: 'b', name: 'Laptop' }), makeLoan({ id: 'c', name: 'Bike' })]
    const text = buildSummary(input({ loans, moneyEntries: entries }), NOW)
    expect(text.length).toBeLessThanOrEqual(SUMMARY_CHAR_BUDGET)
    for (const name of ['Phone', 'Laptop', 'Bike']) expect(text).toContain(name)
  })
})
