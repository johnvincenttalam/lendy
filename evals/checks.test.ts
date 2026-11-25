import { describe, it, expect } from 'vitest'
import { mentionsAmount, mentionsDate, looksTagalog } from './checks'

describe('eval checks', () => {
  it('finds an amount however it is written, but not inside a bigger number', () => {
    expect(mentionsAmount('over by **₱1,251.25** a month', 1251.25)).toBe(true)
    expect(mentionsAmount('limit is ₱8,000', 8000)).toBe(true)
    expect(mentionsAmount('limit is ₱8,000.00.', 8000)).toBe(true)
    expect(mentionsAmount('P14000 left', 14000)).toBe(true)
    expect(mentionsAmount('₱18,000', 8000)).toBe(false)
    expect(mentionsAmount('₱8,000.50', 8000)).toBe(false)
    expect(mentionsAmount('₱1,251', 1251.25)).toBe(false)
  })

  it('finds a date as ISO or by month and year', () => {
    expect(mentionsDate('on 2027-01-01', '2027-01-01')).toBe(true)
    expect(mentionsDate('finishes in January 2027', '2027-01-01')).toBe(true)
    expect(mentionsDate('done by Jan 1, 2027', '2027-01-01')).toBe(true)
    expect(mentionsDate('done by February 2027', '2027-01-01')).toBe(false)
  })

  it('tells Tagalog from English', () => {
    expect(looksTagalog('Kaya mo pa naman, pero mas mabuti kung maghintay ka muna ng isang buwan.')).toBe(true)
    expect(looksTagalog('You can still manage it, but waiting a month would be better.')).toBe(false)
  })
})
