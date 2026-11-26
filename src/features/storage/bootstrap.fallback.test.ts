import { describe, it, expect, vi } from 'vitest'

// The move code is fetched lazily; a failed fetch (flaky network right after
// an update) must not leave a blank page.
vi.mock('./move', () => ({
  planMove: () => { throw new Error('Failed to fetch dynamically imported module') },
  runMove: vi.fn(),
}))

import { bootstrap } from './bootstrap'
import { memoryStorage } from './testStorage'
import { STORAGE_FIELDS } from '../backup/schema'

describe('start-up when the move code cannot load', () => {
  it('stays on simple storage and shows the data', async () => {
    // Synthetic records only — never real data.
    const storage = memoryStorage({
      [STORAGE_FIELDS.loans]: JSON.stringify([{ id: 'L1', name: 'Phone', totalAmount: 6000, monthlyPayment: 1000, durationMonths: 6, startDate: '2026-01-15', monthsPaid: 0, totalPaid: 0 }]),
    })
    const openDb = vi.fn()
    const out = await bootstrap({ storage, hasIndexedDb: true, openDb, now: new Date('2026-11-27T08:00:00Z') })
    if (out.kind !== 'ready') throw new Error(out.kind)
    expect(out.active.backend.kind).toBe('localstorage')
    expect(out.snapshot.loans.map((l) => l.id)).toEqual(['L1'])
    expect(openDb).not.toHaveBeenCalled()
  })
})
