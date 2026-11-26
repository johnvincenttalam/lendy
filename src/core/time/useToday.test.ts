import { describe, it, expect } from 'vitest'
import { nextToday } from './useToday'

describe('nextToday', () => {
  const evening = new Date(2026, 10, 26, 23, 50)

  it('keeps the same Date while it is still the same day (no re-render)', () => {
    expect(nextToday(evening, new Date(2026, 10, 26, 23, 59))).toBe(evening)
  })

  it('moves to the new day once the date changes, e.g. reopening the app the next morning', () => {
    const morning = new Date(2026, 10, 27, 7, 0)
    expect(nextToday(evening, morning)).toBe(morning)
  })
})
