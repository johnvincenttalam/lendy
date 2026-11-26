import { describe, it, expect, vi } from 'vitest'

// Stores read localStorage when their modules load; Node has none.
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

const file = JSON.stringify({
  schemaVersion: 1,
  loans: [{ id: 'L1', name: 'Phone', color: '#000', totalAmount: 6000, monthlyPayment: 1000, interestRate: 0, durationMonths: 6, startDate: '2026-01-15', monthsPaid: 0, totalPaid: 0, totalInterestPaid: 0, createdAt: '2026-01-01T00:00:00.000Z' }],
})

// Stores refresh from storage asynchronously after a restore.
const settled = () => new Promise((r) => setTimeout(r, 0))

describe('the Undo last restore offer', () => {
  it('appears after a restore and goes away after an undo, wherever the undo came from', async () => {
    const r = prepareRestore(file)
    if (!r.ok) throw new Error('bad fixture')
    expect(useLastRestoreStore.getState().restoredAt).toBeNull()
    expect(applyRestore(r.data)).toBe(true)
    await settled()
    expect(useLastRestoreStore.getState().restoredAt).not.toBeNull()
    // e.g. the UNDO button on the restore toast, while Settings is open
    expect(undoLastRestore()).toBe(true)
    await settled()
    expect(useLastRestoreStore.getState().restoredAt).toBeNull()
  })
})
