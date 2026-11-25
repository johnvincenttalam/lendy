import { describe, it, expect } from 'vitest'
import { hasExistingData, describeBackupImport } from './backupDescribe'

const none = { loans: 0, bills: 0, goals: 0 }
const incoming = { loans: 1, bills: 0, savingsGoals: 2 }

describe('hasExistingData', () => {
  it('is false on a fresh device', () => {
    expect(hasExistingData(none)).toBe(false)
  })

  it('counts loans, bills and goals', () => {
    expect(hasExistingData({ ...none, loans: 1 })).toBe(true)
    expect(hasExistingData({ ...none, bills: 1 })).toBe(true)
    expect(hasExistingData({ ...none, goals: 1 })).toBe(true)
  })
})

describe('describeBackupImport', () => {
  it('asks a plain question on an empty device', () => {
    expect(describeBackupImport(incoming, none)).toBe('Import 1 loan, 2 savings goals from the backup?')
  })

  it('warns that existing data will be replaced', () => {
    expect(describeBackupImport(incoming, { ...none, goals: 5 })).toBe(
      'This will replace your existing data with 1 loan, 2 savings goals from the backup. This cannot be undone.',
    )
  })
})
