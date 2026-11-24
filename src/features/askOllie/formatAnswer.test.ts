import { describe, it, expect } from 'vitest'
import { parseAnswer } from './formatAnswer'

const plain = (text: string) => ({ text, bold: false })
const bold = (text: string) => ({ text, bold: true })

describe('parseAnswer', () => {
  it('turns **bold** into bold spans', () => {
    expect(parseAnswer('Your biggest loan is **Gloan Techno** (₱18,400.00).')).toEqual([
      { type: 'p', lines: [[plain('Your biggest loan is '), bold('Gloan Techno'), plain(' (₱18,400.00).')]] },
    ])
  })

  it('groups bullet lines into a list', () => {
    expect(parseAnswer('Due this week:\n- **Phone**: ₱1,000.00\n* Internet: ₱1,500.00\n• Rent: ₱8,000.00')).toEqual([
      { type: 'p', lines: [[plain('Due this week:')]] },
      { type: 'ul', items: [[bold('Phone'), plain(': ₱1,000.00')], [plain('Internet: ₱1,500.00')], [plain('Rent: ₱8,000.00')]] },
    ])
  })

  it('groups numbered lines into an ordered list', () => {
    expect(parseAnswer('1. Gloan Techno\n2) Sloan 5')).toEqual([
      { type: 'ol', items: [[plain('Gloan Techno')], [plain('Sloan 5')]] },
    ])
  })

  it('keeps plain text as paragraphs split by blank lines', () => {
    expect(parseAnswer('First line\nsecond line\n\nNew paragraph')).toEqual([
      { type: 'p', lines: [[plain('First line')], [plain('second line')]] },
      { type: 'p', lines: [[plain('New paragraph')]] },
    ])
  })

  it('turns headings into bold paragraphs', () => {
    expect(parseAnswer('### Summary\nAll good')).toEqual([
      { type: 'p', lines: [[bold('Summary')], [plain('All good')]] },
    ])
  })

  it('removes stray markdown like backticks and single asterisks', () => {
    expect(parseAnswer('Check `Bills` for *details*')).toEqual([
      { type: 'p', lines: [[plain('Check Bills for details')]] },
    ])
  })

  it('leaves an unmatched ** as text', () => {
    expect(parseAnswer('2 ** 3')).toEqual([{ type: 'p', lines: [[plain('2 ** 3')]] }])
  })
})
