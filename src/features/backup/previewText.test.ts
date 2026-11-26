import { describe, it, expect } from 'vitest'
import { checksumWarning, differentLine, fileLine, heldBackLine, incomeLine, mergeToast, removesLine, setAsideLine, skippedLine } from './previewText'
import type { AreaCounts, DifferentItem } from './planMerge'

const zero: AreaCounts = { added: 0, alreadyHere: 0, different: 0, heldBack: 0, private: 0 }
const item = (over: Partial<DifferentItem> = {}): DifferentItem => ({
  area: 'loans', id: 'L1', name: 'Laptop', fileOnlyDates: [], deviceOnlyCount: 0, detailsDiffer: false, ...over,
})

describe('preview wording', () => {
  it('says which Ollie made the file, or that an earlier one did', () => {
    expect(fileLine({ formatVersion: 2, appVersion: '1.16.0', exportedAt: '2026-11-27T08:00:00.000Z', unknownSections: false, setAside: 0 }))
      .toBe('Made by Ollie 1.16.0 on Nov 27, 2026')
    expect(fileLine({ formatVersion: 1, appVersion: null, exportedAt: '2026-11-01T08:00:00.000Z', unknownSections: false, setAside: 0 }))
      .toBe('Made by an earlier Ollie')
  })

  it('warns only when a v2 file’s check value is wrong or missing', () => {
    const warning = 'This file was changed or damaged since Ollie made it. Look it over before going on.'
    expect(checksumWarning('mismatch')).toBe(warning)
    expect(checksumWarning('missing')).toBe(warning)
    expect(checksumWarning('ok')).toBeNull()
    expect(checksumWarning('none')).toBeNull()
  })

  it('says what keeping this phone’s version leaves out', () => {
    expect(differentLine(item({ fileOnlyDates: ['2026-11-15'], detailsDiffer: true }), false))
      .toBe('"Laptop" loan: the file has 1 payment this phone doesn\'t (Nov 15); other details differ')
    expect(differentLine(item({ area: 'savings', name: 'Fund', fileOnlyDates: ['2026-03-01T00:00:00.000Z', '2026-04-01T00:00:00.000Z'] }), false))
      .toBe('"Fund" goal: the file has 2 deposits this phone doesn\'t (Mar 1, Apr 1)')
    expect(differentLine(item({ area: 'bills', name: 'Water', fileOnlyDates: ['2026-01-05', '2026-02-05', '2026-03-05', '2026-04-05'] }), false))
      .toBe('"Water" bill: the file has 4 payments this phone doesn\'t (Jan 5, Feb 5, Mar 5, …)')
    expect(differentLine(item({ detailsDiffer: true }), false)).toBe('"Laptop" loan: other details differ')
  })

  it('“Use the file’s version” says what this phone loses', () => {
    expect(differentLine(item({ deviceOnlyCount: 1, detailsDiffer: true }), true))
      .toBe('"Laptop" loan: this phone has 1 payment the file doesn\'t; other details differ')
    expect(differentLine(item({ fileOnlyDates: ['2026-11-15'] }), true)).toBe('"Laptop" loan: 1 payment from the file comes in (Nov 15)')
    expect(differentLine(item({ fileOnlyDates: ['2026-11-15', '2026-12-15'], deviceOnlyCount: 1 }), true))
      .toBe('"Laptop" loan: this phone has 1 payment the file doesn\'t; 2 payments from the file come in (Nov 15, Dec 15)')
  })

  it('never names private loans', () => {
    expect(differentLine(item({ name: null, detailsDiffer: true }), false)).toBe('a private loan: other details differ')
    expect(heldBackLine({ area: 'loans', id: 'F', name: null })).toBe('a private loan: same name, amount and start date as one you have')
  })

  it('explains why a record was held back', () => {
    expect(heldBackLine({ area: 'loans', id: 'F', name: 'Phone' })).toBe('"Phone" loan: same name, amount and start date as one you have')
    expect(heldBackLine({ area: 'bills', id: 'F', name: 'Water' })).toBe('"Water" bill: same name, amount and category as one you have')
    expect(heldBackLine({ area: 'savings', id: 'F', name: 'Trip' })).toBe('"Trip" goal: same name and target as one you have')
  })

  it('says what replace would remove', () => {
    expect(removesLine({ loans: 3, bills: 1, savings: 0 })).toBe('removes 3 loans, 1 bill')
    expect(removesLine({ loans: 0, bills: 0, savings: 2 })).toBe('removes 2 savings goals')
    expect(removesLine({ loans: 0, bills: 0, savings: 0 })).toBeNull()
  })

  it('says what happens to the monthly income', () => {
    expect(incomeLine({ device: 30000, file: 25000, result: 30000 })).toBe('Monthly income: keeping ₱30,000.00 (the file has ₱25,000.00)')
    expect(incomeLine({ device: 0, file: 25000, result: 25000 })).toBe('Monthly income: using the file\'s ₱25,000.00')
    expect(incomeLine({ device: 30000, file: 30000, result: 30000 })).toBeNull()
    expect(incomeLine({ device: 30000, file: null, result: 30000 })).toBeNull()
  })

  it('words the toast after a merge', () => {
    expect(mergeToast({ loans: { ...zero, added: 2 }, bills: { ...zero, added: 1 }, savings: zero })).toBe('Merged: 2 loans, 1 bill added')
    expect(mergeToast({ loans: zero, bills: zero, savings: zero })).toBe('Merged: nothing new to add')
  })

  it('mentions records that could not be read, and set-aside records', () => {
    expect(skippedLine(1)).toBe('1 record in the file couldn\'t be read and will be left out.')
    expect(skippedLine(2)).toBe('2 records in the file couldn\'t be read and will be left out.')
    expect(setAsideLine(4)).toBe('4 records Ollie set aside are in this file; they aren\'t imported.')
    expect(setAsideLine(1)).toBe('1 record Ollie set aside is in this file; it isn\'t imported.')
  })
})
