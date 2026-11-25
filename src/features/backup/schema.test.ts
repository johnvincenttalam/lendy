import { describe, it, expect } from 'vitest'
import { SCHEMA_KEY, SCHEMA_VERSION, STORAGE_FIELDS, backupVersion, migrateSnapshot, migrateStorage } from './schema'
import type { Migration } from './schema'

function memoryStorage(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial))
  return {
    map,
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => { map.set(k, v) },
    removeItem: (k: string) => { map.delete(k) },
  }
}

// A pretend v2 that renames bills → recurringBills, and a v3 that tags loans.
const steps: Record<number, Migration> = {
  2: ({ bills, ...rest }) => ({ ...rest, recurringBills: bills }),
  3: (data) => ({ ...data, loans: (data.loans as object[]).map((l) => ({ ...l, v3: true })) }),
}

describe('backupVersion', () => {
  it('reads the stamp, and treats files from before versioning as 0', () => {
    expect(backupVersion({ schemaVersion: 4 })).toBe(4)
    expect(backupVersion({})).toBe(0)
    expect(backupVersion({ schemaVersion: '2' })).toBe(0)
  })
})

describe('migrateSnapshot', () => {
  it('applies each step after the starting version, in order', () => {
    const out = migrateSnapshot({ loans: [{ id: 'a' }], bills: [1] }, 1, steps, 3)
    expect(out).toEqual({ loans: [{ id: 'a', v3: true }], recurringBills: [1] })
  })

  it('skips steps the data has already had', () => {
    expect(migrateSnapshot({ loans: [] }, 2, steps, 3)).toEqual({ loans: [] })
  })

  it('changes nothing with the real migrations for unversioned data', () => {
    const data = { loans: [{ id: 'a' }] }
    expect(migrateSnapshot(data, 0)).toEqual(data)
  })
})

describe('migrateStorage', () => {
  it('stamps a fresh or unversioned device with the current version', () => {
    const storage = memoryStorage({ [STORAGE_FIELDS.loans]: '[]' })
    migrateStorage(storage)
    expect(storage.map.get(SCHEMA_KEY)).toBe(String(SCHEMA_VERSION))
    expect(storage.map.get(STORAGE_FIELDS.loans)).toBe('[]')
  })

  it('rewrites only what a migration changed, and keeps unreadable values', () => {
    const storage = memoryStorage({
      [SCHEMA_KEY]: '1',
      [STORAGE_FIELDS.loans]: '[{"id":"a"}]',
      [STORAGE_FIELDS.bills]: '[1]',
      [STORAGE_FIELDS.payments]: '{not json',
    })
    migrateStorage(storage, { 3: steps[3] }, 3)
    expect(JSON.parse(storage.map.get(STORAGE_FIELDS.loans)!)).toEqual([{ id: 'a', v3: true }])
    expect(storage.map.get(STORAGE_FIELDS.bills)).toBe('[1]')
    expect(storage.map.get(STORAGE_FIELDS.payments)).toBe('{not json')
    expect(storage.map.get(SCHEMA_KEY)).toBe('3')
  })

  it('removes a field a migration dropped', () => {
    const storage = memoryStorage({ [SCHEMA_KEY]: '1', [STORAGE_FIELDS.bills]: '[1]' })
    migrateStorage(storage, { 2: steps[2] }, 2)
    expect(storage.map.has(STORAGE_FIELDS.bills)).toBe(false)
  })

  it('leaves data from a newer version alone', () => {
    const storage = memoryStorage({ [SCHEMA_KEY]: '9', [STORAGE_FIELDS.loans]: '[{"id":"a"}]' })
    migrateStorage(storage, steps, 3)
    expect(storage.map.get(SCHEMA_KEY)).toBe('9')
    expect(storage.map.get(STORAGE_FIELDS.loans)).toBe('[{"id":"a"}]')
  })
})
