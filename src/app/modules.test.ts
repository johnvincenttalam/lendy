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

import { MODULES } from './modules'
import { allWidgets, navEntries, quickAddActions, deadlineCollectors, quickAddTarget } from '../core/modules/registry'

describe('MODULES', () => {
  it('gives every widget a unique id, in the designed default order', () => {
    expect(allWidgets(MODULES).map((w) => w.id)).toEqual(['due-soon', 'money-summary', 'health', 'savings', 'loans'])
  })

  it('lists the money pages for More and the sidebar', () => {
    expect(navEntries(MODULES, 'money').map((n) => n.label)).toEqual(['Bills', 'Savings', 'What-if', 'Analytics'])
  })

  it('offers Loan first in the add menu', () => {
    expect(quickAddActions(MODULES).map((a) => a.label)).toEqual(['Loan', 'Bill', 'Savings goal'])
  })

  it('opens the right form directly on module pages', () => {
    expect(quickAddTarget('/bills', MODULES)).toMatchObject({ action: { id: 'bill' }, privateLoan: false })
    expect(quickAddTarget('/savings', MODULES)).toMatchObject({ action: { id: 'goal' }, privateLoan: false })
    expect(quickAddTarget('/private', MODULES)).toMatchObject({ action: { id: 'loan' }, privateLoan: true })
  })

  it('collects deadlines from loans and bills', () => {
    expect(deadlineCollectors(MODULES)).toHaveLength(2)
  })
})
