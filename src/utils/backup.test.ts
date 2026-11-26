import { describe, it, expect, vi } from 'vitest'

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

import { applyRestore, undoLastRestore } from './backup'
import { useLastRestoreStore } from '../features/backup/lastRestoreStore'
import { prepareRestore } from '../features/backup/prepareRestore'
import { readSafetyCopy } from '../features/backup/restore'
import { getActiveStorage } from '../features/storage/activeStorage'
import { persist } from '../features/storage/persist'
import type { Loan } from '../features/loans/loanTypes'
import { hydrateStores, readStoresSnapshot } from './storeSnapshot'
import { emptySnapshot } from '../features/storage/snapshot'
import { useLastBackupStore } from '../features/backup/lastBackupStore'
import { planMerge } from '../features/backup/planMerge'

// Synthetic records only — never real data.
const phone: Loan = { id: 'L1', name: 'Phone', color: '#000', totalAmount: 6000, monthlyPayment: 1000, interestRate: 0, durationMonths: 6, startDate: '2026-01-15', monthsPaid: 0, totalPaid: 0, totalInterestPaid: 0, createdAt: '2026-01-01T00:00:00.000Z' }
const file = JSON.stringify({ schemaVersion: 1, loans: [phone] })

function prepared() {
  const r = prepareRestore(file)
  if (!r.ok) throw new Error('bad fixture')
  return r.data
}

describe('the Undo last restore offer', () => {
  it('appears after a restore and goes away after an undo, wherever the undo came from', async () => {
    expect(useLastRestoreStore.getState().restoredAt).toBeNull()
    expect(await applyRestore(prepared(), 'replace')).toBe(true)
    expect(useLastRestoreStore.getState().restoredAt).not.toBeNull()
    // e.g. the UNDO button on the restore toast, while Settings is open
    expect(await undoLastRestore()).toBe(true)
    expect(useLastRestoreStore.getState().restoredAt).toBeNull()
  })

  it('a change saved just before the restore is in the safety copy', async () => {
    const added = { ...phone, id: 'NEW', name: 'Just added' }
    void persist({ loans: { next: [added], prev: [] } })
    expect(await applyRestore(prepared(), 'replace')).toBe(true)
    const copy = await readSafetyCopy(getActiveStorage().safety)
    expect(copy?.snapshot.loans.map((l) => l.id)).toContain('NEW')
  })

  it("a merge can be undone and doesn't count as backed up", async () => {
    await getActiveStorage().backend.replaceAll({ ...emptySnapshot(), loans: [{ ...phone, id: 'D1', name: 'On this phone' }] })
    hydrateStores(await getActiveStorage().backend.readAll())
    const before = useLastBackupStore.getState().lastBackupAt
    const file = prepared()
    const plan = planMerge({ snapshot: readStoresSnapshot(), folder: null }, file, { useFileForDifferent: false, addPossibleDuplicates: false, rebuiltPayments: false })
    expect(await applyRestore(plan.next, 'merge', 'Merged: 1 loan added')).toBe(true)
    expect(readStoresSnapshot().loans.map((l) => l.id)).toEqual(['D1', 'L1'])
    expect(useLastBackupStore.getState().lastBackupAt).toBe(before)
    expect(await undoLastRestore()).toBe(true)
    expect(readStoresSnapshot().loans.map((l) => l.id)).toEqual(['D1'])
  })
})
