import { describe, it, expect } from 'vitest'
import { billDeadlines } from './billDeadlines'
import type { Bill, BillPaymentRecord } from './billTypes'

const NOW = new Date(2026, 10, 26, 0, 30)

function bill(over: Partial<Bill> = {}): Bill {
  return {
    id: 'B1', name: 'Water', color: '#10B981', category: 'Utilities', amount: 500,
    nextDueDate: '2026-11-26', createdAt: '2026-01-01T00:00:00.000Z', ...over,
  }
}
const run = (bills: Bill[], billPayments: BillPaymentRecord[] = []) => billDeadlines({ loans: [], bills, billPayments }, NOW)

describe('billDeadlines', () => {
  it('lists a bill due today as today', () => {
    expect(run([bill()])).toEqual([{
      id: 'bills:B1:2026-11-26', module: 'bills', recordId: 'B1', title: 'Water', color: '#10B981',
      amount: 500, installments: 1, daysUntil: 0, dueDate: '2026-11-26', status: 'today', href: '/bills/B1',
    }])
  })

  it('marks yesterday’s bill overdue', () => {
    expect(run([bill({ nextDueDate: '2026-11-25' })])[0]).toMatchObject({ status: 'overdue', daysUntil: -1 })
  })

  it('asks only for what is left of a part-paid cycle', () => {
    const paid: BillPaymentRecord = { id: 'x', billId: 'B1', amount: 200, paidAt: '2026-11-20T03:00:00.000Z', dueDate: '2026-11-26' }
    expect(run([bill()], [paid])[0].amount).toBe(300)
  })

  it('leaves out archived bills', () => {
    expect(run([bill({ archived: true })])).toEqual([])
  })
})
