import 'fake-indexeddb/auto'
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Stores read preferences from localStorage when their modules load; Node has none.
vi.hoisted(() => {
  const map = new Map<string, string>()
  globalThis.localStorage = {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => { map.set(k, v) },
    removeItem: (k: string) => { map.delete(k) },
    clear: () => map.clear(),
    key: () => null,
    length: 0,
  } as Storage
})

import { hydrateStores, readStoresSnapshot } from './storeSnapshot'
import { useLoanStore } from '../features/loans/loanStore'
import { useBillStore } from '../features/bills/billStore'
import { useSavingsStore } from '../features/savings/savingsStore'
import { useIncomeStore } from '../features/finance/incomeStore'
import { setActiveStorage } from '../features/storage/activeStorage'
import { createOllieDb } from '../features/storage/db'
import { createDexieBackend } from '../features/storage/dexieBackend'
import { dexieSafetyStore } from '../features/storage/safetyCopyStore'
import { whenSaved } from '../features/storage/persist'
import { emptySnapshot } from '../features/storage/snapshot'
import type { DataBackend } from '../features/storage/backend'

// Synthetic records only — never real data.
let backend: DataBackend

beforeEach(() => {
  const db = createOllieDb(`t-${crypto.randomUUID()}`)
  backend = createDexieBackend(db)
  setActiveStorage({ backend, safety: dexieSafetyStore(db), prefs: localStorage, db })
  hydrateStores(emptySnapshot())
})

async function expectSaved() {
  await whenSaved()
  expect(await backend.readAll()).toEqual(readStoresSnapshot())
}

const newLoan = { name: 'Phone', color: '#000', totalAmount: 6000, monthlyPayment: 1100, interestRate: 2, durationMonths: 6, startDate: '2026-01-15' }

describe('every store change reaches the database', () => {
  it('loan actions reach the database', async () => {
    const s = () => useLoanStore.getState()
    s().addLoan(newLoan)
    s().addLoan({ ...newLoan, name: 'Laptop' })
    const id = s().loans[0].id
    const other = s().loans[1].id
    await expectSaved()
    s().markAsPaid(id)
    s().markAsPaid(id)
    await expectSaved()
    s().undoMarkAsPaid(id)
    await expectSaved()
    s().updateLoan(id, { totalAmount: 7000 })
    await expectSaved()
    s().recalcMonthlyPayment(id)
    await expectSaved()
    s().archiveLoan(id)
    s().unarchiveLoan(id)
    s().makePrivate(id)
    s().makePublic(id)
    await expectSaved()
    s().deleteLoan(other)
    await expectSaved()
    expect(s().loans).toHaveLength(1)
  })

  it('bill actions reach the database', async () => {
    const s = () => useBillStore.getState()
    s().addBill({ name: 'Internet', color: '#000', category: 'Other', amount: 1500, nextDueDate: '2026-12-05' })
    s().addBill({ name: 'Water', color: '#000', category: 'Utilities', amount: 400, nextDueDate: '2026-12-10' })
    const id = s().bills[0].id
    s().updateBill(id, { amount: 1600 })
    s().recordBillPayment(id, 1600)
    await expectSaved()
    s().undoBillPayment(id)
    s().archiveBill(id)
    s().unarchiveBill(id)
    await expectSaved()
    s().deleteBill(s().bills[1].id)
    await expectSaved()
  })

  it('savings actions reach the database', async () => {
    const s = () => useSavingsStore.getState()
    s().addGoal({ name: 'Fund', color: '#000', targetAmount: 5000 } as Parameters<ReturnType<typeof s>['addGoal']>[0])
    s().addGoal({ name: 'Trip', color: '#000', targetAmount: 9000 } as Parameters<ReturnType<typeof s>['addGoal']>[0])
    const id = s().goals[0].id
    s().updateGoal(id, { name: 'Emergency' })
    s().addFunds(id, 1000, 'first')
    s().withdrawFunds(id, 250)
    await expectSaved()
    s().archiveGoal(id)
    s().unarchiveGoal(id)
    s().deleteGoal(s().goals[1].id)
    await expectSaved()
  })

  it('income reaches the database', async () => {
    useIncomeStore.getState().setMonthlyIncome(42000)
    await whenSaved()
    expect((await backend.readAll()).monthlyIncome).toBe(42000)
  })

  it('after reloading, undo removes the payment made last', async () => {
    const s = () => useLoanStore.getState()
    s().addLoan(newLoan)
    const id = s().loans[0].id
    s().markAsPaid(id)
    s().markAsPaid(id)
    await whenSaved()
    hydrateStores(await backend.readAll())
    s().undoMarkAsPaid(id)
    expect(s().payments.map((p) => p.month)).toEqual([1])
    expect(s().loans[0].monthsPaid).toBe(1)
    await expectSaved()
  })

  it('hydrateStores then readStoresSnapshot returns the same snapshot', () => {
    const snap = {
      ...emptySnapshot(),
      monthlyIncome: 30000,
      bills: [{ id: 'B1', name: 'Internet', color: '#000', category: 'Other', amount: 1500, nextDueDate: '2026-12-05', createdAt: '2026-01-01T00:00:00.000Z' }],
    }
    hydrateStores(snap)
    expect(readStoresSnapshot()).toEqual(snap)
  })
})
