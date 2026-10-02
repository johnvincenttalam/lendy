import { describe, it, expect } from 'vitest'
import { hasExistingData, describeBackupImport } from './backupDescribe'

const none = { loans: 0, bills: 0, goals: 0, moneyEntries: 0 }
const incoming = { loans: 1, bills: 0, savingsGoals: 0, moneyEntries: 2 }

describe('hasExistingData', () => {
  it('is false on a fresh device', () => {
    expect(hasExistingData(none)).toBe(false)
  })

  it('counts money entries, so a money-only device is warned before a restore replaces them', () => {
    expect(hasExistingData({ ...none, moneyEntries: 3 })).toBe(true)
  })

  it('counts loans, bills and goals', () => {
    expect(hasExistingData({ ...none, loans: 1 })).toBe(true)
    expect(hasExistingData({ ...none, bills: 1 })).toBe(true)
    expect(hasExistingData({ ...none, goals: 1 })).toBe(true)
  })
})

describe('describeBackupImport', () => {
  it('asks a plain question on an empty device', () => {
    expect(describeBackupImport(incoming, none)).toBe('Import 1 loan, 2 money entries from the backup?')
  })

  it('warns that existing data will be replaced when only money entries exist', () => {
    expect(describeBackupImport(incoming, { ...none, moneyEntries: 5 })).toBe(
      'This will replace your existing data with 1 loan, 2 money entries from the backup. This cannot be undone.',
    )
  })
})
