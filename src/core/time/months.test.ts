import { describe, it, expect } from 'vitest'
import { addMonthsClamped } from './months'

const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

describe('addMonthsClamped', () => {
  it('moves to the same day of a later month', () => {
    expect(ymd(addMonthsClamped(new Date(2026, 0, 15), 1))).toBe('2026-02-15')
  })

  it('never spills into the next month (Jan 31 → Feb 28)', () => {
    expect(ymd(addMonthsClamped(new Date(2026, 0, 31), 1))).toBe('2026-02-28')
  })

  it('uses Feb 29 in a leap year', () => {
    expect(ymd(addMonthsClamped(new Date(2028, 0, 31), 1))).toBe('2028-02-29')
  })

  it('keeps the original day after passing a short month', () => {
    // Counted from the start each time, so Feb's clamp doesn't stick.
    expect(ymd(addMonthsClamped(new Date(2026, 0, 31), 2))).toBe('2026-03-31')
    expect(ymd(addMonthsClamped(new Date(2026, 0, 31), 3))).toBe('2026-04-30')
  })

  it('crosses year boundaries', () => {
    expect(ymd(addMonthsClamped(new Date(2026, 10, 30), 3))).toBe('2027-02-28')
  })

  it('keeps the time of day', () => {
    const out = addMonthsClamped(new Date(2026, 0, 31, 8, 30), 1)
    expect([out.getHours(), out.getMinutes()]).toEqual([8, 30])
  })

  it('does not change the date it was given', () => {
    const start = new Date(2026, 0, 31)
    addMonthsClamped(start, 1)
    expect(ymd(start)).toBe('2026-01-31')
  })
})
