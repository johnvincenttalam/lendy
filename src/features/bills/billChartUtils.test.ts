import { describe, it, expect } from 'vitest'
import { buildMonthlyBillTotals } from './billChartUtils'
import type { Bill, BillPaymentRecord } from './billTypes'

function makeBill(overrides: Partial<Bill> = {}): Bill {
  return {
    id: 'bill-1',
    name: 'Rent',
    color: '#F3622D',
    category: 'Rent',
    amount: 8000,
    nextDueDate: '2026-04-01',
    createdAt: '2025-10-01T00:00:00.000Z',
    ...overrides,
  }
}

let seq = 0
function makePayment(overrides: Partial<BillPaymentRecord> = {}): BillPaymentRecord {
  seq += 1
  return {
    id: 'pay-' + seq,
    billId: 'bill-1',
    amount: 8000,
    paidAt: '2026-03-01T09:00:00.000Z',
    dueDate: '2026-03-01',
    ...overrides,
  }
}

/** "Now" for most tests: mid-April, so a March cycle counts as a finished month. */
const APRIL_2026 = new Date(2026, 3, 15)

describe('buildMonthlyBillTotals', () => {
  it('groups a payment under the cycle it covered, not the month it was paid', () => {
    const bills = [makeBill()]
    // March's rent, settled three days late in April.
    const payments = [makePayment({ dueDate: '2026-03-01', paidAt: '2026-04-03T09:00:00.000Z' })]

    const result = buildMonthlyBillTotals(bills, payments, 6, APRIL_2026)

    expect(result).toEqual([{ key: '2026-03', label: 'Mar', total: 8000, inProgress: false }])
  })

  it('sums several partial payments made against the same cycle', () => {
    const bills = [makeBill()]
    const payments = [
      makePayment({ dueDate: '2026-03-01', amount: 3000 }),
      makePayment({ dueDate: '2026-03-01', amount: 5000 }),
    ]

    const result = buildMonthlyBillTotals(bills, payments, 6, APRIL_2026)

    expect(result[0].total).toBe(8000)
  })

  it('sums payments from different bills falling in the same month', () => {
    const bills = [makeBill(), makeBill({ id: 'bill-2', name: 'Internet', amount: 1200 })]
    const payments = [
      makePayment({ billId: 'bill-1', dueDate: '2026-03-01', amount: 8000 }),
      makePayment({ billId: 'bill-2', dueDate: '2026-03-10', amount: 1200 }),
    ]

    const result = buildMonthlyBillTotals(bills, payments, 6, APRIL_2026)

    expect(result[0].total).toBe(9200)
  })

  it('excludes payments belonging to an archived bill', () => {
    const bills = [makeBill(), makeBill({ id: 'bill-2', archived: true })]
    const payments = [
      makePayment({ billId: 'bill-1', dueDate: '2026-03-01', amount: 8000 }),
      makePayment({ billId: 'bill-2', dueDate: '2026-03-01', amount: 5000 }),
    ]

    const result = buildMonthlyBillTotals(bills, payments, 6, APRIL_2026)

    expect(result[0].total).toBe(8000)
  })

  it('keeps payments whose bill no longer exists', () => {
    // deleteBill prunes its own payment records, so an orphan is a data-shape
    // edge case rather than something the user chose to archive.
    const payments = [makePayment({ billId: 'gone', dueDate: '2026-03-01', amount: 4000 })]

    const result = buildMonthlyBillTotals([], payments, 6, APRIL_2026)

    expect(result[0].total).toBe(4000)
  })

  it('reports a skipped month between two paid months as zero', () => {
    const bills = [makeBill()]
    const payments = [
      makePayment({ dueDate: '2026-01-01', amount: 8000 }),
      makePayment({ dueDate: '2026-03-01', amount: 8000 }),
    ]

    const result = buildMonthlyBillTotals(bills, payments, 6, APRIL_2026)

    expect(result).toEqual([
      { key: '2026-01', label: 'Jan', total: 8000, inProgress: false },
      { key: '2026-02', label: 'Feb', total: 0, inProgress: false },
      { key: '2026-03', label: 'Mar', total: 8000, inProgress: false },
    ])
  })

  it('does not pad with empty months before the first recorded payment', () => {
    const bills = [makeBill()]
    const payments = [makePayment({ dueDate: '2026-03-01', amount: 8000 })]

    const result = buildMonthlyBillTotals(bills, payments, 6, APRIL_2026)

    expect(result).toHaveLength(1)
  })

  it('trims finished months after the last payment rather than trailing empty bars', () => {
    const bills = [makeBill()]
    const payments = [makePayment({ dueDate: '2026-01-01', amount: 8000 })]

    const result = buildMonthlyBillTotals(bills, payments, 6, APRIL_2026)

    expect(result.map((m) => m.key)).toEqual(['2026-01'])
  })

  it('shows at most monthCount months, keeping the most recent', () => {
    const bills = [makeBill()]
    const payments = [
      makePayment({ dueDate: '2025-09-01', amount: 100 }),
      makePayment({ dueDate: '2025-10-01', amount: 200 }),
      makePayment({ dueDate: '2025-11-01', amount: 300 }),
      makePayment({ dueDate: '2025-12-01', amount: 400 }),
      makePayment({ dueDate: '2026-01-01', amount: 500 }),
      makePayment({ dueDate: '2026-02-01', amount: 600 }),
      makePayment({ dueDate: '2026-03-01', amount: 700 }),
    ]

    const result = buildMonthlyBillTotals(bills, payments, 6, APRIL_2026)

    expect(result.map((m) => m.key)).toEqual([
      '2025-10', '2025-11', '2025-12', '2026-01', '2026-02', '2026-03',
    ])
  })

  it('marks the current month as still in progress', () => {
    const bills = [makeBill()]
    const payments = [
      makePayment({ dueDate: '2026-03-01', amount: 8000 }),
      makePayment({ dueDate: '2026-04-01', amount: 3000 }),
    ]

    const result = buildMonthlyBillTotals(bills, payments, 6, APRIL_2026)

    expect(result).toEqual([
      { key: '2026-03', label: 'Mar', total: 8000, inProgress: false },
      { key: '2026-04', label: 'Apr', total: 3000, inProgress: true },
    ])
  })

  it('ignores cycles due after the current month', () => {
    // Paying ahead shouldn't open a future bar, nor inflate any visible month.
    const bills = [makeBill()]
    const payments = [
      makePayment({ dueDate: '2026-03-01', amount: 8000 }),
      makePayment({ dueDate: '2026-05-01', amount: 9999 }),
    ]

    const result = buildMonthlyBillTotals(bills, payments, 6, APRIL_2026)

    expect(result.map((m) => m.key)).toEqual(['2026-03'])
    expect(result.reduce((sum, m) => sum + m.total, 0)).toBe(8000)
  })

  it('reads the month from the date string rather than local time', () => {
    // new Date('2026-03-01') is midnight UTC, which is still February 28th in
    // the Americas and would file March's rent under February there.
    const bills = [makeBill()]
    const payments = [makePayment({ dueDate: '2026-03-01', amount: 8000 })]

    const result = buildMonthlyBillTotals(bills, payments, 6, APRIL_2026)

    expect(result[0].key).toBe('2026-03')
    expect(result[0].label).toBe('Mar')
  })

  it('returns nothing when no payments have been recorded', () => {
    const result = buildMonthlyBillTotals([makeBill()], [], 6, APRIL_2026)

    expect(result).toEqual([])
  })

  it('returns nothing when every payment belongs to an archived bill', () => {
    const bills = [makeBill({ archived: true })]
    const payments = [makePayment({ dueDate: '2026-03-01', amount: 8000 })]

    const result = buildMonthlyBillTotals(bills, payments, 6, APRIL_2026)

    expect(result).toEqual([])
  })

  it('spans a year boundary without losing months', () => {
    const bills = [makeBill()]
    const payments = [
      makePayment({ dueDate: '2025-12-01', amount: 400 }),
      makePayment({ dueDate: '2026-01-01', amount: 500 }),
    ]

    const result = buildMonthlyBillTotals(bills, payments, 6, new Date(2026, 1, 15))

    expect(result).toEqual([
      { key: '2025-12', label: 'Dec', total: 400, inProgress: false },
      { key: '2026-01', label: 'Jan', total: 500, inProgress: false },
    ])
  })
})
