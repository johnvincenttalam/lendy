import { describe, it, expect } from 'vitest'
import { planMerge, planReplace } from './planMerge'
import type { MergeOptions } from './planMerge'
import type { RestoreData } from './restore'
import { emptySnapshot } from '../storage/snapshot'
import type { DataSnapshot } from '../storage/snapshot'
import type { Loan, PaymentRecord } from '../loans/loanTypes'
import type { Bill } from '../bills/billTypes'
import type { SavingsGoal, SavingsTransaction } from '../savings/savingsTypes'
import type { FolderBackup } from '../privateFolder/privateFolderUtils'

// Synthetic records only — never real data.
const loan = (id: string, over: Partial<Loan> = {}): Loan => ({
  id, name: `Loan ${id}`, color: '#000', totalAmount: 6000, monthlyPayment: 1000, interestRate: 0,
  durationMonths: 6, startDate: '2026-01-15', monthsPaid: 0, totalPaid: 0, totalInterestPaid: 0,
  createdAt: '2026-01-01T00:00:00.000Z', ...over,
})
const payment = (id: string, loanId: string, month: number, over: Partial<PaymentRecord> = {}): PaymentRecord => ({
  id, loanId, amount: 1000, principal: 1000, interest: 0, paidAt: `2026-0${month + 1}-15T00:00:00.000Z`,
  dueDate: `2026-0${month + 1}-15`, month, ...over,
})
const bill = (id: string, over: Partial<Bill> = {}): Bill => ({
  id, name: `Bill ${id}`, color: '#000', category: 'Other', amount: 1500, nextDueDate: '2026-12-05',
  createdAt: '2026-01-01T00:00:00.000Z', ...over,
})
const goal = (id: string, over: Partial<SavingsGoal> = {}): SavingsGoal => ({
  id, name: `Goal ${id}`, color: '#000', targetAmount: 5000, currentAmount: 0,
  createdAt: '2026-01-01T00:00:00.000Z', ...over,
})
const tx = (id: string, goalId: string): SavingsTransaction => ({ id, goalId, type: 'deposit', amount: 100, createdAt: '2026-03-01T00:00:00.000Z' })

const device = (over: Partial<DataSnapshot> = {}): DataSnapshot => ({ ...emptySnapshot(), ...over })
const file = (over: Partial<RestoreData> = {}): RestoreData => ({
  loans: [], payments: [], bills: [], billPayments: [], savingsGoals: [], savingsTransactions: [],
  monthlyIncome: null, privateFolder: null, ...over,
})
const opts = (over: Partial<MergeOptions> = {}): MergeOptions => ({ useFileForDifferent: false, addPossibleDuplicates: false, rebuiltPayments: false, ...over })
const noFolder = { folder: null as FolderBackup | null }
const ids = (xs: { id: string }[]) => xs.map((x) => x.id)

describe('planMerge', () => {
  it('adds records that are only in the file, with their children, at the end', () => {
    const d = device({ loans: [loan('D1')] })
    const f = file({ loans: [loan('F1', { name: 'New one', totalAmount: 9000 })], payments: [payment('FP1', 'F1', 1)] })
    const plan = planMerge({ snapshot: d, ...noFolder }, f, opts())
    expect(ids(plan.next.loans)).toEqual(['D1', 'F1'])
    expect(ids(plan.next.payments)).toEqual(['FP1'])
    expect(plan.counts.loans.added).toBe(1)
    expect(plan.changes).toBe(true)
  })

  it('skips exact repeats', () => {
    const d = device({ loans: [loan('L1')], payments: [payment('P1', 'L1', 1)], bills: [bill('B1')] })
    const f = file({ loans: [loan('L1')], payments: [payment('P1', 'L1', 1)], bills: [bill('B1')] })
    const plan = planMerge({ snapshot: d, ...noFolder }, f, opts())
    expect(plan.counts.loans.alreadyHere).toBe(1)
    expect(plan.counts.bills.alreadyHere).toBe(1)
    expect(plan.changes).toBe(false)
    const { monthlyIncome: _m, privateFolder: _p, ...rest } = plan.next
    void _m; void _p
    const { monthlyIncome: _dm, ...deviceRest } = d
    void _dm
    expect(rest).toEqual(deviceRest)
  })

  it("keeps this phone's version of a record that differs, with its own children", () => {
    const d = device({ loans: [loan('L1', { name: 'Phone' })], payments: [payment('P1', 'L1', 1), payment('P2', 'L1', 2)] })
    const f = file({ loans: [loan('L1', { name: 'Phone', notes: 'changed' })], payments: [payment('P1', 'L1', 1), payment('P3', 'L1', 3)] })
    const plan = planMerge({ snapshot: d, ...noFolder }, f, opts())
    expect(ids(plan.next.payments)).toEqual(['P1', 'P2'])
    expect(plan.next.loans[0].notes).toBeUndefined()
    expect(plan.counts.loans.different).toBe(1)
    expect(plan.different).toEqual([{ area: 'loans', id: 'L1', name: 'Phone', fileOnlyDates: ['2026-04-15'], deviceOnlyCount: 1, detailsDiffer: true }])
    expect(plan.changes).toBe(false)
  })

  it("with the switch on, takes the file's record and children, removing this phone's extra children", () => {
    const d = device({ loans: [loan('L0'), loan('L1')], payments: [payment('P0', 'L0', 1), payment('P1', 'L1', 1), payment('P2', 'L1', 2)] })
    const f = file({ loans: [loan('L1', { notes: 'changed' })], payments: [payment('P1', 'L1', 1), payment('P3', 'L1', 3)] })
    const plan = planMerge({ snapshot: d, ...noFolder }, f, opts({ useFileForDifferent: true }))
    expect(ids(plan.next.loans)).toEqual(['L0', 'L1'])
    expect(plan.next.loans[1].notes).toBe('changed')
    expect(ids(plan.next.payments)).toEqual(['P0', 'P1', 'P3'])
    expect(plan.changes).toBe(true)
  })

  it('holds back a possible double entry, and adds it with the switch', () => {
    const d = device({ loans: [loan('D1', { name: 'Phone' })] })
    const f = file({ loans: [loan('F9', { name: ' phone ' })], payments: [payment('FP', 'F9', 1)] })
    const held = planMerge({ snapshot: d, ...noFolder }, f, opts())
    expect(held.heldBack).toEqual([{ area: 'loans', id: 'F9', name: ' phone ' }])
    expect(ids(held.next.loans)).toEqual(['D1'])
    expect(held.next.payments).toEqual([])
    expect(held.counts.loans.heldBack).toBe(1)
    const added = planMerge({ snapshot: d, ...noFolder }, f, opts({ addPossibleDuplicates: true }))
    expect(ids(added.next.loans)).toEqual(['D1', 'F9'])
    expect(ids(added.next.payments)).toEqual(['FP'])
  })

  it('treats bills and goals the same way, with their own match keys', () => {
    const d = device({ bills: [bill('B1', { name: 'Water', amount: 400, category: 'Utilities' })], savingsGoals: [goal('G1', { name: 'Trip', targetAmount: 9000 })], savingsTransactions: [tx('T1', 'G1')] })
    const f = file({
      bills: [bill('B9', { name: 'Water', amount: 400, category: 'Utilities' })],
      savingsGoals: [goal('G1', { name: 'Trip', targetAmount: 9000 }), goal('G9', { name: 'Trip', targetAmount: 9000 })],
      savingsTransactions: [tx('T1', 'G1'), tx('T2', 'G1')],
    })
    const plan = planMerge({ snapshot: d, ...noFolder }, f, opts())
    // G1 is in the file too, so the file itself shows G9 is a separate goal.
    expect(plan.heldBack.map((h) => h.id)).toEqual(['B9'])
    expect(ids(plan.next.savingsGoals)).toEqual(['G1', 'G9'])
    expect(plan.different).toEqual([{ area: 'savings', id: 'G1', name: 'Trip', fileOnlyDates: ['2026-03-01T00:00:00.000Z'], deviceOnlyCount: 0, detailsDiffer: false }])
  })

  it('never names private loans', () => {
    const d = device({ loans: [loan('L1', { private: true }), loan('D2', { name: 'Secret', private: true })] })
    const f = file({ loans: [loan('L1', { private: true, notes: 'x' }), loan('F2', { name: 'Secret', private: true })] })
    const plan = planMerge({ snapshot: d, ...noFolder }, f, opts())
    expect(plan.different[0].name).toBeNull()
    expect(plan.heldBack[0].name).toBeNull()
    expect(plan.counts.loans.private).toBe(2)
  })

  it("income: keeps the phone's, takes the file's when the phone has none or the switch is on", () => {
    const keep = planMerge({ snapshot: device({ monthlyIncome: 30000 }), ...noFolder }, file({ monthlyIncome: 25000 }), opts())
    expect(keep.next.monthlyIncome).toBeNull()
    expect(keep.income).toEqual({ device: 30000, file: 25000, result: 30000 })
    const fill = planMerge({ snapshot: device({ monthlyIncome: 0 }), ...noFolder }, file({ monthlyIncome: 25000 }), opts())
    expect(fill.next.monthlyIncome).toBe(25000)
    expect(fill.changes).toBe(true)
    const take = planMerge({ snapshot: device({ monthlyIncome: 30000 }), ...noFolder }, file({ monthlyIncome: 25000 }), opts({ useFileForDifferent: true }))
    expect(take.income.result).toBe(25000)
  })

  it("folder: keeps the phone's folder; takes the file's when the phone has none; warns when the phone's has no PIN and private loans arrive", () => {
    const fileFolder = { name: 'File', pinHash: 'abc', recoveryHash: null }
    const f = file({ loans: [loan('F1', { private: true })], privateFolder: fileFolder })
    const kept = planMerge({ snapshot: device(), folder: { name: 'Mine', pinHash: 'zzz', recoveryHash: null } }, f, opts())
    expect(kept.next.privateFolder).toBeNull()
    expect(kept.folderWarning).toBe(false)
    const taken = planMerge({ snapshot: device(), folder: null }, f, opts())
    expect(taken.next.privateFolder).toEqual(fileFolder)
    const warned = planMerge({ snapshot: device(), folder: { name: 'Mine', pinHash: null, recoveryHash: null } }, f, opts())
    expect(warned.folderWarning).toBe(true)
  })

  it('merging twice gives the same result as once', () => {
    const d = device({ loans: [loan('D1')], monthlyIncome: 0 })
    const f = file({ loans: [loan('F1', { name: 'Other', totalAmount: 1 })], payments: [payment('FP', 'F1', 1)], bills: [bill('FB')], monthlyIncome: 20000 })
    const first = planMerge({ snapshot: d, ...noFolder }, f, opts())
    const applied: DataSnapshot = { ...first.next, monthlyIncome: first.income.result }
    expect(planMerge({ snapshot: applied, ...noFolder }, f, opts()).changes).toBe(false)
  })

  it('compares rebuilt payment history by loan, month and amount', () => {
    const d = device({ loans: [loan('L1', { monthsPaid: 1 })], payments: [payment('P1', 'L1', 1)] })
    const f = file({ loans: [loan('L1', { monthsPaid: 1 })], payments: [payment('RANDOM', 'L1', 1, { paidAt: '2026-02-15T08:00:00.000Z' })] })
    const plan = planMerge({ snapshot: d, ...noFolder }, f, opts({ rebuiltPayments: true }))
    expect(plan.counts.loans.alreadyHere).toBe(1)
    expect(plan.changes).toBe(false)
  })
})

describe('planReplace', () => {
  it('counts what replace would remove', () => {
    const d = device({ loans: [loan('L1'), loan('L2')], bills: [bill('B1')], savingsGoals: [goal('G1')] })
    const f = file({ loans: [loan('L1')], bills: [bill('B1')] })
    expect(planReplace(d, f).removes).toEqual({ loans: 1, bills: 0, savings: 1 })
  })
})

describe('final review fixes', () => {
  it("taking the file's version never moves a loan out of the private folder", () => {
    const d = device({ loans: [loan('L1', { private: true })] })
    const f = file({ loans: [loan('L1', { notes: 'from the file' })] })
    const plan = planMerge({ snapshot: d, folder: { name: 'P', pinHash: 'h', recoveryHash: null } }, f, opts({ useFileForDifferent: true }))
    expect(plan.next.loans[0].notes).toBe('from the file')
    expect(plan.next.loans[0].private).toBe(true)
  })

  it('a held-back line never names a private loan on this phone', () => {
    const d = device({ loans: [loan('L1', { name: 'Secret', private: true })] })
    const f = file({ loans: [loan('L2', { name: 'Secret' })] })
    const plan = planMerge({ snapshot: d, folder: { name: 'P', pinHash: 'h', recoveryHash: null } }, f, opts())
    expect(plan.heldBack).toEqual([{ area: 'loans', id: 'L2', name: null }])
  })

  it('a second look-alike record the file itself shows is separate is added, not held back', () => {
    const d = device({ bills: [bill('B1', { name: 'Internet' })] })
    const f = file({ bills: [bill('B1', { name: 'Internet' }), bill('B2', { name: 'Internet' })] })
    const plan = planMerge({ snapshot: d, ...noFolder }, f, opts())
    expect(plan.heldBack).toEqual([])
    expect(ids(plan.next.bills)).toEqual(['B1', 'B2'])
  })

  it("takes the file's private folder only when private loans come with it", () => {
    const f = file({ loans: [loan('F1')], privateFolder: { name: 'File', pinHash: 'abc', recoveryHash: null } })
    const plan = planMerge({ snapshot: device({ loans: [loan('F1')] }), folder: null }, f, opts())
    expect(plan.next.privateFolder).toBeNull()
    expect(plan.changes).toBe(false)
  })
})
