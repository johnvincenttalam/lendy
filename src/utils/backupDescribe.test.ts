import { describe, it, expect } from 'vitest'
import { hasExistingData } from './backupDescribe'

const none = { loans: 0, bills: 0, goals: 0 }

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
