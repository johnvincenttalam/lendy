import { describe, it, expect } from 'vitest'
import { daysSinceBackup, describeLastBackup, isBackupDue } from './backupStatus'

const now = new Date(2026, 10, 25, 9, 0)

describe('backup status', () => {
  it('counts calendar days, not 24-hour blocks', () => {
    expect(daysSinceBackup(new Date(2026, 10, 24, 23, 30).toISOString(), now)).toBe(1)
    expect(daysSinceBackup(new Date(2026, 10, 25, 0, 5).toISOString(), now)).toBe(0)
  })

  it('treats a missing or broken date as never backed up', () => {
    expect(daysSinceBackup(null, now)).toBeNull()
    expect(daysSinceBackup('nonsense', now)).toBeNull()
  })

  it('is due when never backed up or after 30 days', () => {
    expect(isBackupDue(null, now)).toBe(true)
    expect(isBackupDue(new Date(2026, 9, 26).toISOString(), now)).toBe(true)
    expect(isBackupDue(new Date(2026, 9, 27).toISOString(), now)).toBe(false)
  })

  it('describes the last backup in plain words', () => {
    expect(describeLastBackup(null, now)).toBe('Never backed up')
    expect(describeLastBackup(new Date(2026, 10, 25, 8).toISOString(), now)).toBe('Last backup: today')
    expect(describeLastBackup(new Date(2026, 10, 24).toISOString(), now)).toBe('Last backup: yesterday')
    expect(describeLastBackup(new Date(2026, 9, 22).toISOString(), now)).toBe('Last backup: 34 days ago')
  })
})
