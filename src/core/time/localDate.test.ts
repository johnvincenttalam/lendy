import { describe, it, expect } from 'vitest'
import { localISODate, parseLocalISODate } from './localDate'

describe('local dates', () => {
  it('runs in the pinned test time zone (Asia/Manila, UTC+8)', () => {
    expect(new Date(2026, 0, 1).getTimezoneOffset()).toBe(-480)
  })

  it('formats local calendar fields', () => {
    expect(localISODate(new Date(2026, 1, 3, 23, 59))).toBe('2026-02-03')
  })

  it('parses to local midnight', () => {
    const d = parseLocalISODate('2026-02-28')
    expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours()]).toEqual([2026, 1, 28, 0])
  })

  it('round-trips', () => {
    expect(localISODate(parseLocalISODate('2028-02-29'))).toBe('2028-02-29')
  })
})
